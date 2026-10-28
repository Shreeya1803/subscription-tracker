-- Phase 2: data rules. Replaces the NestJS validation DTOs, ownership checks and the
-- free-tier limit with database constraints, triggers and Row Level Security, so the app
-- can talk to the tables directly and still cannot break the rules.

-- =====================================================================
-- Helpers (in a schema the API does not expose)
-- =====================================================================
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- security definer so the checks can read memberships/households without RLS recursion.
create function private.is_household_member(p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.household_id = p_household and m.user_id = (select auth.uid())
  );
$$;

create function private.owns_household(p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.households h
    where h.id = p_household and h.owner_user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_household_member(uuid) from public;
revoke all on function private.owns_household(uuid) from public;
grant execute on function private.is_household_member(uuid) to authenticated, service_role;
grant execute on function private.owns_household(uuid) to authenticated, service_role;

-- No API role needs these table-level powers (TRUNCATE would bypass RLS).
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- =====================================================================
-- subscriptions
-- =====================================================================
-- Same rules as CreateSubscriptionDto / IsValidCustomCycleDays.
alter table public.subscriptions
  add constraint subscriptions_name_length     check (char_length(name) between 1 and 200),
  add constraint subscriptions_amount_positive check (amount > 0),
  add constraint subscriptions_currency_iso    check (currency ~ '^[A-Z]{3}$'),
  add constraint subscriptions_custom_cycle    check (
    (billing_cycle = 'custom' and coalesce(custom_cycle_days, 0) > 0)
    or (billing_cycle <> 'custom' and custom_cycle_days is null)
  ),
  add constraint subscriptions_reminder_days   check (reminder_days_before between 0 and 365),
  add constraint subscriptions_notes_length    check (notes is null or char_length(notes) <= 1000);

-- The app never sends user_id: it is always the signed-in user.
alter table public.subscriptions alter column user_id set default auth.uid();

-- Tidy values before the checks run:
--  * trim the name;
--  * switching away from a custom cycle clears custom_cycle_days;
--  * a new renewal date re-arms the reminder (as the NestJS update did).
create function private.subscriptions_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  if new.billing_cycle <> 'custom' then
    new.custom_cycle_days := null;
  end if;
  if tg_op = 'UPDATE' and new.next_renewal is distinct from old.next_renewal then
    new.last_reminder_sent_at := null;
  end if;
  return new;
end;
$$;

create trigger subscriptions_normalize
  before insert or update on public.subscriptions
  for each row execute function private.subscriptions_normalize();

-- Free plan: at most 3 active subscriptions. Raised as SQLSTATE PT403, which the API
-- returns as HTTP 403 (same as the NestJS ForbiddenException), so the app shows the upgrade screen.
create function private.enforce_free_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan   public.premium_status;
  v_active integer;
begin
  if new.status <> 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' then
    return new;  -- already counted
  end if;

  -- Lock the user's row so two simultaneous adds cannot both slip under the limit.
  select premium_status into v_plan from public.users where id = new.user_id for update;

  if v_plan = 'free' then
    select count(*) into v_active
    from public.subscriptions
    where user_id = new.user_id and status = 'active' and id <> new.id;

    if v_active >= 3 then
      raise exception using
        errcode = 'PT403',
        message = 'Free tier is limited to 3 active subscriptions. Upgrade to premium for unlimited tracking.',
        hint    = 'FREE_LIMIT_REACHED';
    end if;
  end if;
  return new;
end;
$$;

create trigger subscriptions_enforce_free_limit
  before insert or update of status on public.subscriptions
  for each row execute function private.enforce_free_limit();

revoke all on function private.subscriptions_normalize() from public;
revoke all on function private.enforce_free_limit() from public;

-- Columns the app may write. status and last_used_date change only through the
-- cancel / mark-used functions (Phase 3); last_reminder_sent_at only through the reminder job.
revoke insert, update on public.subscriptions from authenticated;
grant insert (household_id, name, amount, currency, billing_cycle, custom_cycle_days, next_renewal,
              category, reminder_enabled, reminder_days_before, notes)
  on public.subscriptions to authenticated;
grant update (household_id, name, amount, currency, billing_cycle, custom_cycle_days, next_renewal,
              category, reminder_enabled, reminder_days_before, notes)
  on public.subscriptions to authenticated;

create policy "subscriptions: read own or shared with my household"
  on public.subscriptions for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (household_id is not null and private.is_household_member(household_id))
  );

create policy "subscriptions: add own"
  on public.subscriptions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (household_id is null or private.owns_household(household_id))
  );

create policy "subscriptions: edit own"
  on public.subscriptions for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (household_id is null or private.owns_household(household_id))
  );

create policy "subscriptions: delete own"
  on public.subscriptions for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- =====================================================================
-- saved_events, payment_events: read-only for the owner
-- =====================================================================
revoke insert, update, delete on public.saved_events, public.payment_events from authenticated;

create policy "saved_events: read own"
  on public.saved_events for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "payment_events: read own"
  on public.payment_events for select
  to authenticated
  using (user_id = (select auth.uid()));

-- =====================================================================
-- households and memberships (V2)
-- =====================================================================
alter table public.households
  add constraint households_name_length check (char_length(btrim(name)) between 1 and 100);
alter table public.households alter column owner_user_id set default auth.uid();

-- Creating a household also makes its creator the owner member (as HouseholdService.create did).
create function private.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.memberships (household_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner');
  return new;
end;
$$;
revoke all on function private.add_owner_membership() from public;

create trigger households_add_owner_membership
  after insert on public.households
  for each row execute function private.add_owner_membership();

revoke insert, update, delete on public.households from authenticated;
grant insert (name) on public.households to authenticated;
grant update (name) on public.households to authenticated;

create policy "households: read if member"
  on public.households for select
  to authenticated
  using (owner_user_id = (select auth.uid()) or private.is_household_member(id));

create policy "households: create as owner"
  on public.households for insert
  to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy "households: owner renames"
  on public.households for update
  to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

-- Memberships are added only by the invite function (Phase 3).
revoke insert, update, delete on public.memberships from authenticated;

create policy "memberships: read members of my households"
  on public.memberships for select
  to authenticated
  using (private.is_household_member(household_id));
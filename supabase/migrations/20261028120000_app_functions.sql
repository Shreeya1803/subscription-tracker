-- Phase 3: app functions. The NestJS endpoints that do more than read/write one table
-- become Postgres functions the app calls with supabase.rpc('<name>', { ... }).
-- Errors use SQLSTATE PTxyz, which the API returns as HTTP status xyz:
--   PT403 = not allowed / premium only, PT404 = not found, PT409 = conflict.

-- ---------- monthly normalisation (TDD 10.1, as normalize-to-monthly.ts) ----------
create function private.monthly_amount(p_amount numeric, p_cycle public.billing_cycle, p_custom_days integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_cycle
    when 'weekly'    then p_amount * 52 / 12
    when 'monthly'   then p_amount
    when 'quarterly' then p_amount / 3
    when 'yearly'    then p_amount / 12
    when 'custom'    then p_amount * 30.44 / p_custom_days
  end;
$$;
revoke all on function private.monthly_amount(numeric, public.billing_cycle, integer) from public;
grant execute on function private.monthly_amount(numeric, public.billing_cycle, integer) to authenticated, service_role;

-- Premium-only features raise PT403 for free users.
create function private.require_premium(p_feature text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce((select premium_status from public.users where id = (select auth.uid())), 'free') = 'free' then
    raise exception using errcode = 'PT403', message = p_feature || ' is a premium feature. Upgrade to see it.',
      hint = 'PREMIUM_REQUIRED';
  end if;
end;
$$;
revoke all on function private.require_premium(text) from public;
grant execute on function private.require_premium(text) to authenticated;

-- =====================================================================
-- cancel_subscription: mark canceled and record the money saved (POST /subscriptions/:id/cancel)
-- =====================================================================
create function public.cancel_subscription(p_subscription_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  select * into v_sub from public.subscriptions
  where id = p_subscription_id and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception using errcode = 'PT404', message = 'Subscription not found';
  end if;
  if v_sub.status = 'canceled' then
    raise exception using errcode = 'PT409', message = 'Subscription is already canceled';
  end if;

  update public.subscriptions set status = 'canceled' where id = v_sub.id
  returning * into v_sub;

  insert into public.saved_events (user_id, subscription_id, monthly_amount_saved, canceled_at)
  values (v_sub.user_id, v_sub.id,
          round(private.monthly_amount(v_sub.amount, v_sub.billing_cycle, v_sub.custom_cycle_days), 2),
          now());

  return v_sub;
end;
$$;

-- =====================================================================
-- mark_subscription_used: last used = today (POST /subscriptions/:id/mark-used)
-- =====================================================================
create function public.mark_subscription_used(p_subscription_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  update public.subscriptions set last_used_date = current_date
  where id = p_subscription_id and user_id = (select auth.uid())
  returning * into v_sub;

  if not found then
    raise exception using errcode = 'PT404', message = 'Subscription not found';
  end if;
  return v_sub;
end;
$$;

-- =====================================================================
-- dashboard_summary (GET /dashboard/summary)
-- Sums normalised amounts with no currency conversion, as the TDD specifies;
-- mixed_currencies tells the app when that total mixes currencies.
-- =====================================================================
create function public.dashboard_summary()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_monthly numeric;
  v_currencies text[];
  v_upcoming jsonb;
  v_saved   numeric;
begin
  select coalesce(sum(private.monthly_amount(amount, billing_cycle, custom_cycle_days)), 0),
         coalesce(array_agg(distinct currency) filter (where currency is not null), '{}')
    into v_monthly, v_currencies
  from public.subscriptions
  where user_id = v_uid and status = 'active';

  select coalesce(jsonb_agg(to_jsonb(s) order by s.next_renewal, s.name), '[]'::jsonb)
    into v_upcoming
  from public.subscriptions s
  where s.user_id = v_uid and s.status = 'active'
    and s.next_renewal between current_date and current_date + 30;

  select coalesce(sum(monthly_amount_saved), 0) into v_saved
  from public.saved_events where user_id = v_uid;

  return jsonb_build_object(
    'monthly_total',       round(v_monthly, 2),
    'annual_total',        round(v_monthly * 12, 2),
    'mixed_currencies',    coalesce(array_length(v_currencies, 1), 0) > 1,
    'currencies',          to_jsonb(v_currencies),
    'upcoming_renewals',   v_upcoming,
    'total_monthly_saved', round(v_saved, 2)
  );
end;
$$;

-- =====================================================================
-- dashboard_trends: premium only (GET /dashboard/trends)
-- =====================================================================
create function public.dashboard_trends(p_months integer default 6)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_months integer := least(greatest(coalesce(p_months, 6), 1), 24);
  v_trends jsonb;
  v_categories jsonb;
begin
  perform private.require_premium('Spend trends');

  with months as (
    select (date_trunc('month', now()) - make_interval(months => i)) as month_start
    from generate_series(v_months - 1, 0, -1) as i
  ),
  subs as (
    select s.*, (select min(e.canceled_at) from public.saved_events e where e.subscription_id = s.id) as canceled_at
    from public.subscriptions s
    where s.user_id = v_uid and s.status in ('active', 'canceled')
  )
  select jsonb_agg(jsonb_build_object(
           'month', to_char(m.month_start, 'YYYY-MM'),
           'monthly_total', round(coalesce((
             select sum(private.monthly_amount(x.amount, x.billing_cycle, x.custom_cycle_days))
             from subs x
             where x.created_at < m.month_start + interval '1 month'
               and (x.canceled_at is null or x.canceled_at >= m.month_start)
           ), 0), 2)
         ) order by m.month_start)
    into v_trends
  from months m;

  select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'monthly_total', round(c.total, 2))
                            order by c.category), '[]'::jsonb)
    into v_categories
  from (
    select category, sum(private.monthly_amount(amount, billing_cycle, custom_cycle_days)) as total
    from public.subscriptions
    where user_id = v_uid and status = 'active'
    group by category
  ) c;

  return jsonb_build_object(
    'trends', v_trends,
    'category_breakdown', v_categories,
    'note', 'Trends reflect spend since each subscription was added to the app (based on when it was tracked here), not necessarily when the real-world subscription began. Paused subscriptions are excluded from trend totals (no reliable "paused since" date exists in the data model).'
  );
end;
$$;

-- =====================================================================
-- dashboard_unused: premium only (GET /dashboard/unused)
-- Never flags a subscription with no last-used date (TDD 10.4: unknown is not unused).
-- =====================================================================
create function public.dashboard_unused(p_threshold_days integer default 30)
returns setof public.subscriptions
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require_premium('Unused-subscription detection');
  return query
    select * from public.subscriptions
    where user_id = (select auth.uid())
      and status = 'active'
      and last_used_date is not null
      and last_used_date < current_date - greatest(coalesce(p_threshold_days, 30), 1)
    order by last_used_date, name;
end;
$$;

-- =====================================================================
-- export_my_data (GET /user/export). Never includes credentials.
-- =====================================================================
create function public.export_my_data()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'user', (
      select jsonb_build_object(
        'id', u.id, 'email', u.email, 'display_name', u.display_name,
        'default_currency', u.default_currency, 'premium_status', u.premium_status,
        'premium_expires_at', u.premium_expires_at, 'push_token', u.push_token,
        'created_at', u.created_at, 'updated_at', u.updated_at)
      from public.users u where u.id = (select auth.uid())
    ),
    'subscriptions', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.created_at)
      from public.subscriptions s where s.user_id = (select auth.uid())), '[]'::jsonb),
    'saved_events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.canceled_at)
      from public.saved_events e where e.user_id = (select auth.uid())), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(to_jsonb(m) || jsonb_build_object('household', to_jsonb(h)) order by m.created_at)
      from public.memberships m join public.households h on h.id = m.household_id
      where m.user_id = (select auth.uid())), '[]'::jsonb),
    'payment_events', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at)
      from public.payment_events p where p.user_id = (select auth.uid())), '[]'::jsonb)
  );
$$;

-- =====================================================================
-- Households (V2): invite and detail
-- =====================================================================
create function public.invite_household_member(p_household_id uuid, p_email text)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role    public.household_role;
  v_invitee uuid;
  v_row     public.memberships;
begin
  select role into v_role from public.memberships
  where household_id = p_household_id and user_id = (select auth.uid());
  if not found then
    raise exception using errcode = 'PT404', message = 'Household not found';
  end if;
  if v_role <> 'owner' then
    raise exception using errcode = 'PT403', message = 'Only the household owner can invite members';
  end if;

  select id into v_invitee from public.users where lower(email) = lower(btrim(p_email));
  if v_invitee is null then
    raise exception using errcode = 'PT404', message = 'No account exists with that email. They need to sign up first.';
  end if;

  insert into public.memberships (household_id, user_id, role)
  values (p_household_id, v_invitee, 'member')
  on conflict (household_id, user_id) do nothing
  returning * into v_row;
  if v_row.id is null then
    raise exception using errcode = 'PT409', message = 'This user is already a member of the household';
  end if;
  return v_row;
end;
$$;

-- Household with its members (name and email only) and shared subscriptions.
create function public.household_detail(p_household_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from public.memberships
                 where household_id = p_household_id and user_id = (select auth.uid())) then
    raise exception using errcode = 'PT404', message = 'Household not found';
  end if;

  select to_jsonb(h) || jsonb_build_object(
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'role', m.role, 'created_at', m.created_at,
               'user', jsonb_build_object('id', u.id, 'email', u.email, 'display_name', u.display_name))
             order by m.created_at)
      from public.memberships m join public.users u on u.id = m.user_id
      where m.household_id = h.id), '[]'::jsonb),
    'subscriptions', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.name)
      from public.subscriptions s where s.household_id = h.id), '[]'::jsonb)
  ) into v_result
  from public.households h where h.id = p_household_id;

  return v_result;
end;
$$;

-- =====================================================================
-- Who may call what: only signed-in users. (Supabase grants new functions to anon by default.)
-- =====================================================================
revoke all on function public.cancel_subscription(uuid)                 from public, anon;
revoke all on function public.mark_subscription_used(uuid)              from public, anon;
revoke all on function public.dashboard_summary()                       from public, anon;
revoke all on function public.dashboard_trends(integer)                 from public, anon;
revoke all on function public.dashboard_unused(integer)                 from public, anon;
revoke all on function public.export_my_data()                          from public, anon;
revoke all on function public.invite_household_member(uuid, text)      from public, anon;
revoke all on function public.household_detail(uuid)                    from public, anon;

grant execute on function public.cancel_subscription(uuid)              to authenticated;
grant execute on function public.mark_subscription_used(uuid)           to authenticated;
grant execute on function public.dashboard_summary()                    to authenticated;
grant execute on function public.dashboard_trends(integer)              to authenticated;
grant execute on function public.dashboard_unused(integer)              to authenticated;
grant execute on function public.export_my_data()                       to authenticated;
grant execute on function public.invite_household_member(uuid, text)   to authenticated;
grant execute on function public.household_detail(uuid)                 to authenticated;
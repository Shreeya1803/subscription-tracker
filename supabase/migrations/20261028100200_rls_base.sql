-- Row Level Security: every table is locked by default.
-- Phase 1 opens only the user's own profile row. Policies for subscriptions,
-- households, saved_events and payment_events are added in Phase 2.

alter table public.users          enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.households     enable row level security;
alter table public.memberships    enable row level security;
alter table public.saved_events   enable row level security;
alter table public.payment_events enable row level security;

-- This app has no anonymous (logged-out) data access at all.
revoke all on all tables in schema public from anon;

-- ---------- users ----------
create policy "users: read own row"
  on public.users for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "users: update own row"
  on public.users for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Rows are created by the sign-up trigger and deleted with the auth user,
-- so the app can never insert or delete them directly. It may only edit its
-- own profile fields: the plan columns (premium_*) are written only by the
-- RevenueCat webhook running with the service role.
revoke insert, update, delete on public.users from authenticated;
grant update (display_name, default_currency, push_token) on public.users to authenticated;
-- Explicit table permissions for Supabase's API roles.
-- Newer Supabase projects grant these automatically on every new table; older projects
-- (like the production one) do not, which left the app and the Edge Functions with
-- "permission denied". Granting them here makes every project behave the same.
-- Row Level Security still decides WHICH rows each user can see or change.

grant usage on schema public to authenticated, service_role;

-- Server side (Edge Functions with the secret key): full access, bypasses RLS.
grant select, insert, update, delete on all tables in schema public to service_role;

-- Signed-in app users: reading is filtered by the RLS policies; writes stay limited to the
-- columns granted in the earlier migrations (users, subscriptions, households).
grant select on public.users, public.subscriptions, public.households, public.memberships,
                public.saved_events, public.payment_events
  to authenticated;
grant delete on public.subscriptions to authenticated;

-- Logged-out requests: nothing (as in 20261028100200_rls_base.sql).
revoke all on all tables in schema public from anon;
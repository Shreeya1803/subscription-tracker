-- Phase 5: scheduled jobs (replace the two @Cron jobs that ran on Render).
--   * subscription-reminders (daily): roll past renewal dates forward and send renewal reminders
--     as push notifications through the Expo push service (TDD 10.5).
--   * billing-expiry-check (hourly): calls the billing-expiry Edge Function, the safety net for
--     missed RevenueCat EXPIRATION webhooks.
-- Needs two Vault secrets per project (set once, see the setup guide): project_url and cron_secret.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------- next renewal after one billing cycle (as add-billing-cycle.ts) ----------
create function private.add_billing_cycle(p_date date, p_cycle public.billing_cycle, p_custom_days integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_cycle
    when 'weekly'    then p_date + 7
    when 'monthly'   then (p_date + interval '1 month')::date
    when 'quarterly' then (p_date + interval '3 months')::date
    when 'yearly'    then (p_date + interval '1 year')::date
    when 'custom'    then p_date + p_custom_days
  end;
$$;

-- ---------- push notification through Expo (fire-and-forget via pg_net) ----------
create function private.send_push(p_token text, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    return;  -- not an Expo push token
  end if;
  perform net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    body    := jsonb_build_object('to', p_token, 'title', p_title, 'body', p_body, 'sound', 'default'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json')
  );
end;
$$;

-- ---------- daily: roll renewals forward, then send due reminders ----------
create function private.process_reminders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r         record;
  v_next    date;
  v_steps   integer;
  v_rolled  integer := 0;
  v_sent    integer := 0;
begin
  -- 1. A renewal date in the past moves forward by whole billing cycles until it is today or later.
  for r in
    select id, next_renewal, billing_cycle, custom_cycle_days
    from public.subscriptions
    where status = 'active' and next_renewal < current_date
    for update
  loop
    v_next := r.next_renewal;
    v_steps := 0;
    while v_next < current_date and v_steps < 5000 loop
      v_next := private.add_billing_cycle(v_next, r.billing_cycle, r.custom_cycle_days);
      v_steps := v_steps + 1;
    end loop;
    update public.subscriptions
      set next_renewal = v_next, last_reminder_sent_at = null
      where id = r.id;
    v_rolled := v_rolled + 1;
  end loop;

  -- 2. Reminder due (renewal date minus reminder days has arrived) and not yet sent this cycle.
  for r in
    select s.id, s.name, s.next_renewal, u.push_token
    from public.subscriptions s
    join public.users u on u.id = s.user_id
    where s.status = 'active'
      and s.reminder_enabled
      and u.push_token is not null
      and current_date >= s.next_renewal - s.reminder_days_before
      and (s.last_reminder_sent_at is null
           or s.last_reminder_sent_at::date < s.next_renewal - s.reminder_days_before)
    for update of s
  loop
    perform private.send_push(
      r.push_token,
      'Renewal coming up',
      format('%s renews on %s', r.name, to_char(r.next_renewal, 'FMDD Mon YYYY'))
    );
    update public.subscriptions set last_reminder_sent_at = now() where id = r.id;
    v_sent := v_sent + 1;
  end loop;

  raise log 'Reminder run complete: % sent, % renewals rolled forward', v_sent, v_rolled;
  return jsonb_build_object('reminders_sent', v_sent, 'renewals_rolled_forward', v_rolled);
end;
$$;

-- ---------- hourly: call the billing-expiry Edge Function ----------
create function private.invoke_billing_expiry()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'billing-expiry: Vault secrets project_url / cron_secret are not set';
    return;
  end if;
  perform net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/billing-expiry',
    body    := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function private.add_billing_cycle(date, public.billing_cycle, integer) from public;
revoke all on function private.send_push(text, text, text) from public;
revoke all on function private.process_reminders() from public;
revoke all on function private.invoke_billing_expiry() from public;

-- ---------- schedules (UTC). 03:30 UTC = 09:00 India; scheduling by name replaces an existing job. ----------
select cron.schedule('subscription-reminders', '30 3 * * *', 'select private.process_reminders()');
select cron.schedule('billing-expiry-check', '5 * * * *', 'select private.invoke_billing_expiry()');
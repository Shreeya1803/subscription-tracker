-- Push reminders: the app registers each phone's Expo push token, and the daily reminder job
-- sends a clearer message on Android's "Renewal reminders" channel that opens the subscription.

-- ---------- register_push_token: called by the app after the user allows notifications ----------
-- A phone has one token. If someone else was signed in on this phone before, the token is taken
-- away from their account, so they never receive reminders on a phone they no longer use.
create function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception using errcode = 'PT401', message = 'Not signed in';
  end if;
  if p_token is null or char_length(p_token) > 200 or p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$' then
    raise exception using errcode = 'PT400', message = 'Invalid push token';
  end if;

  update public.users set push_token = null where push_token = p_token and id <> v_uid;
  update public.users set push_token = p_token where id = v_uid;
end;
$$;

revoke all on function public.register_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;

-- ---------- push message: now with Android channel and data the app uses to open the subscription ----------
create function private.send_push(p_token text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
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
    body    := jsonb_build_object(
                 'to', p_token,
                 'title', p_title,
                 'body', p_body,
                 'sound', 'default',
                 'priority', 'high',
                 'channelId', 'renewal-reminders',
                 'data', coalesce(p_data, '{}'::jsonb)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json')
  );
end;
$$;
revoke all on function private.send_push(text, text, text, jsonb) from public;

-- ---------- daily job: same rules as before, clearer text ----------
--   title: "Netflix renews tomorrow" / "Netflix renews in 3 days" / "Netflix renews today"
--   body:  "INR 649.00 on 6 Nov. Tap to review or cancel."
create or replace function private.process_reminders()
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
  v_days    integer;
  v_when    text;
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
    select s.id, s.name, s.amount, s.currency, s.next_renewal, u.push_token
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
    v_days := r.next_renewal - current_date;
    v_when := case
                when v_days <= 0 then 'today'
                when v_days = 1 then 'tomorrow'
                else format('in %s days', v_days)
              end;
    perform private.send_push(
      r.push_token,
      format('%s renews %s', r.name, v_when),
      format('%s %s on %s. Tap to review or cancel.',
             r.currency, to_char(r.amount, 'FM999999990.00'), to_char(r.next_renewal, 'FMDD Mon')),
      jsonb_build_object('subscriptionId', r.id, 'type', 'renewal-reminder')
    );
    update public.subscriptions set last_reminder_sent_at = now() where id = r.id;
    v_sent := v_sent + 1;
  end loop;

  raise log 'Reminder run complete: % sent, % renewals rolled forward', v_sent, v_rolled;
  return jsonb_build_object('reminders_sent', v_sent, 'renewals_rolled_forward', v_rolled);
end;
$$;
revoke all on function private.process_reminders() from public;

-- The old 3-argument version is no longer used.
drop function private.send_push(text, text, text);
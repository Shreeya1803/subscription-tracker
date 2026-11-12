-- Notification history: every renewal reminder the app sends is also saved, so people can see
-- their past reminders from the bell on the Overview. Sending reminders works exactly as before.

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  kind            text not null default 'renewal-reminder',
  title           text not null,
  body            text not null,
  sent_at         timestamptz not null default now(),
  read_at         timestamptz
);
create index notifications_user_sent_idx on public.notifications (user_id, sent_at desc);

alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications_update_own" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- People can read, mark as read and clear their own notifications; only the reminder job adds them.
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

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
  v_title   text;
  v_body    text;
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
    select s.id, s.user_id, s.name, s.amount, s.currency, s.next_renewal, u.push_token
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
    v_title := format('%s renews %s', r.name, v_when);
    v_body := format('%s %s on %s. Tap to review or cancel.',
                     r.currency, to_char(r.amount, 'FM999999990.00'), to_char(r.next_renewal, 'FMDD Mon'));
    perform private.send_push(
      r.push_token, v_title, v_body,
      jsonb_build_object('subscriptionId', r.id, 'type', 'renewal-reminder')
    );
    -- Keep a copy for the in-app notification list (bell on the Overview).
    insert into public.notifications (user_id, subscription_id, kind, title, body)
    values (r.user_id, r.id, 'renewal-reminder', v_title, v_body);
    update public.subscriptions set last_reminder_sent_at = now() where id = r.id;
    v_sent := v_sent + 1;
  end loop;

  -- 3. The list only keeps the last 90 days.
  delete from public.notifications where sent_at < now() - interval '90 days';

  raise log 'Reminder run complete: % sent, % renewals rolled forward', v_sent, v_rolled;
  return jsonb_build_object('reminders_sent', v_sent, 'renewals_rolled_forward', v_rolled);
end;
$$;

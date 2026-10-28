-- Create the public.users profile row automatically when someone signs up with Supabase Auth,
-- and keep its email in step when the user changes their email address.
--
-- The app passes the profile fields at sign-up:
--   supabase.auth.signUp({ email, password,
--     options: { data: { display_name: 'Asha', default_currency: 'INR' } } })

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name     text := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
  v_currency text := upper(coalesce(new.raw_user_meta_data ->> 'default_currency', ''));
begin
  if v_currency !~ '^[A-Z]{3}$' then
    v_currency := 'USD';
  end if;

  insert into public.users (id, email, display_name, default_currency)
  values (
    new.id,
    new.email,
    left(coalesce(v_name, split_part(new.email, '@', 1)), 100),
    v_currency
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- These run only as triggers; nobody should be able to call them directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;
-- Subscription Tracker: base schema for the Supabase-only architecture.
-- Same tables and columns as the NestJS/Prisma version, except:
--   * users.id is the Supabase Auth user id (auth.users), so passwords, reset
--     tokens and refresh tokens are handled by Supabase Auth, not this table;
--   * every child row is deleted automatically when its user is deleted.

-- ---------- Enums ----------
create type public.premium_status      as enum ('free', 'monthly', 'annual', 'lifetime');
create type public.billing_cycle       as enum ('weekly', 'monthly', 'quarterly', 'yearly', 'custom');
create type public.category            as enum ('entertainment', 'utilities', 'work', 'health', 'other');
create type public.subscription_status as enum ('active', 'paused', 'canceled');
create type public.household_role      as enum ('owner', 'member');

-- ---------- updated_at helper ----------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- users (profile + plan; one row per Supabase Auth user) ----------
create table public.users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text not null unique,
  display_name       text not null check (char_length(display_name) between 1 and 100),
  default_currency   text not null check (default_currency ~ '^[A-Z]{3}$'),
  premium_status     public.premium_status not null default 'free',
  push_token         text,
  -- Set only by the RevenueCat webhook / billing sync (service role). Null for free and lifetime.
  premium_expires_at timestamptz,
  premium_product_id text,
  premium_store      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ---------- households (V2) ----------
create table public.households (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_user_id uuid not null references public.users (id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index households_owner_user_id_idx on public.households (owner_user_id);

-- ---------- memberships (V2) ----------
create table public.memberships (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  role         public.household_role not null,
  created_at   timestamptz not null default now(),
  unique (household_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

-- ---------- subscriptions ----------
create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users (id) on delete cascade,
  household_id          uuid references public.households (id) on delete set null,
  name                  text not null,
  amount                numeric(10, 2) not null,
  currency              text not null,
  billing_cycle         public.billing_cycle not null,
  custom_cycle_days     integer,
  next_renewal          date not null,
  category              public.category not null,
  reminder_enabled      boolean not null default true,
  reminder_days_before  integer not null,
  last_used_date        date,
  last_reminder_sent_at timestamptz,
  status                public.subscription_status not null default 'active',
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_household_id_idx on public.subscriptions (household_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------- saved_events (money saved by canceling) ----------
create table public.saved_events (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users (id) on delete cascade,
  subscription_id      uuid not null references public.subscriptions (id) on delete cascade,
  monthly_amount_saved numeric(10, 2) not null,
  canceled_at          timestamptz not null
);
create index saved_events_user_id_idx on public.saved_events (user_id);
create index saved_events_subscription_id_idx on public.saved_events (subscription_id);

-- ---------- payment_events (RevenueCat webhook log) ----------
create table public.payment_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  provider          text not null,
  product_id        text not null,
  receipt_reference text not null,
  amount            numeric(10, 2),
  currency          text,
  event_id          text unique,  -- a re-delivered webhook is processed once
  event_type        text,
  purchased_at      timestamptz not null,
  created_at        timestamptz not null default now()
);
create index payment_events_user_id_idx on public.payment_events (user_id);
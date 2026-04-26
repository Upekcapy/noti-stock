create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text not null,
  name text,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text not null,
  target_price numeric(14, 4) not null,
  direction text not null check (direction in ('above', 'below')),
  status text not null default 'active' check (status in ('active', 'paused', 'triggered', 'deleted')),
  last_checked_price numeric(14, 4),
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists price_alerts_unique_active_target
  on public.price_alerts (user_id, symbol, direction, target_price)
  where status = 'active';

create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  alert_id uuid references public.price_alerts(id) on delete set null,
  symbol text not null,
  title text not null,
  body text not null,
  target_price numeric(14, 4),
  trigger_price numeric(14, 4),
  delivery_status text not null check (delivery_status in ('sent', 'failed', 'simulated')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.stock_price_cache (
  symbol text primary key,
  price numeric(14, 4) not null,
  change numeric(14, 4),
  change_percent numeric(10, 4),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists price_alerts_touch_updated_at on public.price_alerts;
create trigger price_alerts_touch_updated_at
before update on public.price_alerts
for each row execute function public.touch_updated_at();

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
from auth.users
where email is not null
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.profiles.full_name),
  updated_at = now();

alter table public.profiles enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.price_alerts enable row level security;
alter table public.notification_history enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.stock_price_cache enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users manage own watchlist" on public.watchlist_items;
create policy "Users manage own watchlist"
on public.watchlist_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own alerts" on public.price_alerts;
create policy "Users manage own alerts"
on public.price_alerts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users read own notifications" on public.notification_history;
create policy "Users read own notifications"
on public.notification_history for select
using (auth.uid() = user_id);

drop policy if exists "Users create own notifications" on public.notification_history;
create policy "Users create own notifications"
on public.notification_history for insert
with check (auth.uid() = user_id);

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
on public.push_subscriptions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read stock cache" on public.stock_price_cache;
create policy "Authenticated users can read stock cache"
on public.stock_price_cache for select
to authenticated
using (true);

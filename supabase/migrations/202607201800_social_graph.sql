-- Social profile, friends, and notifications
create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  user_code text not null unique,
  display_name text not null default 'Athlete',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_user_code_format check (user_code ~ '^[a-z0-9_]{6,20}$')
);

create or replace function public.generate_user_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    exit when not exists (select 1 from public.user_profiles where user_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.touch_updated_at();

create or replace function public.ensure_user_profile(
  p_user_id uuid,
  p_email text,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, user_code, display_name)
  values (
    p_user_id,
    public.generate_user_code(),
    coalesce(nullif(trim(p_name), ''), split_part(coalesce(p_email, ''), '@', 1), 'Athlete')
  )
  on conflict (user_id) do update
    set display_name = coalesce(nullif(trim(excluded.display_name), ''), user_profiles.display_name);
end;
$$;

create or replace function public.ensure_current_user_profile()
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_row auth.users%rowtype;
  profile_row public.user_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into auth_row from auth.users where id = auth.uid();
  if auth_row.id is null then
    raise exception 'auth_user_missing';
  end if;

  perform public.ensure_user_profile(
    auth_row.id,
    auth_row.email,
    auth_row.raw_user_meta_data ->> 'name'
  );

  select * into profile_row from public.user_profiles where user_id = auth.uid();
  return profile_row;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_user_profile(
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

insert into public.user_profiles (user_id, user_code, display_name)
select
  u.id,
  public.generate_user_code(),
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(u.email, ''), '@', 1), 'Athlete')
from auth.users u
left join public.user_profiles p on p.user_id = u.id
where p.user_id is null;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_status_check check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index if not exists friendships_unique_active_pair
on public.friendships (
  least(requester_id::text, addressee_id::text),
  greatest(requester_id::text, addressee_id::text)
)
where status in ('pending', 'accepted');

create index if not exists friendships_requester_idx on public.friendships (requester_id, status);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  type text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type in ('friend_request', 'friend_request_accepted'))
);

create index if not exists notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.user_profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "user_profiles_select_policy" on public.user_profiles;
create policy "user_profiles_select_policy"
on public.user_profiles
for select
to authenticated
using (is_public = true or user_id = auth.uid());

drop policy if exists "user_profiles_update_own_policy" on public.user_profiles;
create policy "user_profiles_update_own_policy"
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "friendships_select_member_policy" on public.friendships;
create policy "friendships_select_member_policy"
on public.friendships
for select
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "friendships_insert_public_policy" on public.friendships;
create policy "friendships_insert_public_policy"
on public.friendships
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.user_profiles sender_profile
    where sender_profile.user_id = requester_id and sender_profile.is_public = true
  )
  and exists (
    select 1 from public.user_profiles recipient_profile
    where recipient_profile.user_id = addressee_id and recipient_profile.is_public = true
  )
);

drop policy if exists "friendships_update_member_policy" on public.friendships;
create policy "friendships_update_member_policy"
on public.friendships
for update
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid())
with check (
  (addressee_id = auth.uid() and status in ('accepted', 'declined'))
  or (requester_id = auth.uid() and status = 'cancelled')
);

drop policy if exists "notifications_select_own_policy" on public.notifications;
create policy "notifications_select_own_policy"
on public.notifications
for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists "notifications_insert_actor_policy" on public.notifications;
create policy "notifications_insert_actor_policy"
on public.notifications
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and recipient_id <> auth.uid()
);

drop policy if exists "notifications_update_own_policy" on public.notifications;
create policy "notifications_update_own_policy"
on public.notifications
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

grant execute on function public.ensure_current_user_profile() to authenticated;

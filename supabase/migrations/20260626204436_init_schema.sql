-- NearMatch core schema: profiles, swipes, matches, messages.
-- Matches are never inserted directly by clients — only via record_swipe(),
-- which atomically checks for a mutual like and creates the match. This
-- keeps "a match exists" as a server-verified fact, not a client claim.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  age int not null check (age >= 18 and age <= 120),
  gender text check (gender in ('Man', 'Woman', 'Non-binary')),
  bio text check (char_length(bio) <= 500),
  avatar_emoji text,
  photo_url text,
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- swipes
-- ---------------------------------------------------------------------
create table public.swipes (
  id bigint generated always as identity primary key,
  swiper_id uuid not null references public.profiles (id) on delete cascade,
  swiped_id uuid not null references public.profiles (id) on delete cascade,
  direction text not null check (direction in ('like', 'pass')),
  created_at timestamptz not null default now(),
  unique (swiper_id, swiped_id),
  check (swiper_id <> swiped_id)
);

alter table public.swipes enable row level security;

create policy "users can view their own swipes"
  on public.swipes for select
  to authenticated
  using (swiper_id = auth.uid());

-- No direct insert/update/delete policies: all swipe writes go through
-- record_swipe() below (SECURITY DEFINER), never through direct table access.

-- ---------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------
create table public.matches (
  id bigint generated always as identity primary key,
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

alter table public.matches enable row level security;

create policy "users can view their own matches"
  on public.matches for select
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- No insert/update/delete policies for clients: matches are only created
-- by record_swipe() below.

-- ---------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------
create table public.messages (
  id bigint generated always as identity primary key,
  match_id bigint not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_match_id_created_at_idx on public.messages (match_id, created_at);

alter table public.messages enable row level security;

create policy "participants can view messages in their matches"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );

create policy "participants can send messages in their matches"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- record_swipe: the only way swipes/matches get written.
-- Runs as SECURITY DEFINER so it can write to swipes/matches despite
-- those tables having no client-facing insert policies, but it still
-- only ever acts on behalf of auth.uid() — never an arbitrary user.
-- ---------------------------------------------------------------------
create or replace function public.record_swipe(p_swiped_id uuid, p_direction text)
returns table (matched boolean, match_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_swiper_id uuid := auth.uid();
  v_reverse_like boolean;
  v_match_id bigint;
  v_user_a uuid;
  v_user_b uuid;
begin
  if v_swiper_id is null then
    raise exception 'not authenticated';
  end if;

  if p_direction not in ('like', 'pass') then
    raise exception 'invalid direction';
  end if;

  if v_swiper_id = p_swiped_id then
    raise exception 'cannot swipe on yourself';
  end if;

  insert into public.swipes (swiper_id, swiped_id, direction)
  values (v_swiper_id, p_swiped_id, p_direction)
  on conflict (swiper_id, swiped_id) do update set direction = excluded.direction;

  if p_direction = 'pass' then
    return query select false, null::bigint;
    return;
  end if;

  select exists (
    select 1 from public.swipes
    where swiper_id = p_swiped_id
      and swiped_id = v_swiper_id
      and direction = 'like'
  ) into v_reverse_like;

  if not v_reverse_like then
    return query select false, null::bigint;
    return;
  end if;

  if v_swiper_id < p_swiped_id then
    v_user_a := v_swiper_id;
    v_user_b := p_swiped_id;
  else
    v_user_a := p_swiped_id;
    v_user_b := v_swiper_id;
  end if;

  insert into public.matches (user_a, user_b)
  values (v_user_a, v_user_b)
  on conflict (user_a, user_b) do nothing
  returning id into v_match_id;

  if v_match_id is null then
    select id into v_match_id from public.matches
    where user_a = v_user_a and user_b = v_user_b;
  end if;

  return query select true, v_match_id;
end;
$$;

revoke all on function public.record_swipe(uuid, text) from public;
grant execute on function public.record_swipe(uuid, text) to authenticated;

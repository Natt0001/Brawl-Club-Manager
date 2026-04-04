create extension if not exists pgcrypto;

do $$ begin create type app_role as enum ('owner', 'admin', 'moderator', 'viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type member_role as enum ('president', 'vice_president', 'member'); exception when duplicate_object then null; end $$;
do $$ begin create type season_status as enum ('draft', 'active', 'closed', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type member_status as enum ('active', 'inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type sanction_type as enum ('warning', 'strike', 'kick_note', 'other'); exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null unique,
  color_theme text,
  club_tag text unique,
  power_rank integer not null unique,
  max_members integer not null default 30 check (max_members > 0 and max_members <= 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  game_name text not null,
  game_tag text,
  display_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_persons_game_name_tag_unique
on public.persons (game_name, coalesce(game_tag, ''));


create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  season_number integer,
  starts_at timestamptz,
  ends_at timestamptz,
  status season_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_season_settings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  objective_trophies integer not null default 0 check (objective_trophies >= 0),
  big_objective_trophies integer not null default 0 check (big_objective_trophies >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, club_id)
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  role member_role not null default 'member',
  status member_status not null default 'active',
  trophies_start integer not null default 0 check (trophies_start >= 0),
  trophies_end integer not null default 0 check (trophies_end >= 0),
  last_seen_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, club_id, season_id)
);

create table if not exists public.member_sanctions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  sanction sanction_type not null default 'warning',
  reason text,
  points integer not null default 1 check (points >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  message text not null,
  payload_before jsonb,
  payload_after jsonb,
  created_at timestamptz not null default now()
);

create or replace view public.membership_stats as
select
  m.id as membership_id,
  m.person_id,
  m.club_id,
  m.season_id,
  m.role,
  m.status,
  p.game_name,
  p.game_tag,
  c.name as club_name,
  s.name as season_name,
  css.objective_trophies,
  css.big_objective_trophies,
  m.trophies_start,
  m.trophies_end,
  greatest(m.trophies_end - m.trophies_start, 0) as trophies_push,
  case
    when greatest(m.trophies_end - m.trophies_start, 0) >= css.big_objective_trophies then 3
    when greatest(m.trophies_end - m.trophies_start, 0) >= (css.big_objective_trophies / 2.0) then 1
    else 0
  end as objective_points,
  (
    select count(*)::int
    from public.member_sanctions ms
    where ms.membership_id = m.id and ms.sanction = 'warning'
  ) as warning_count,
  m.last_seen_at,
  m.internal_notes
from public.memberships m
join public.persons p on p.id = m.person_id
join public.clubs c on c.id = m.club_id
join public.seasons s on s.id = m.season_id
left join public.club_season_settings css on css.club_id = m.club_id and css.season_id = m.season_id;

create or replace view public.club_season_rankings as
select
  c.id as club_id,
  c.name as club_name,
  c.power_rank,
  s.id as season_id,
  s.name as season_name,
  coalesce(sum(greatest(m.trophies_end - m.trophies_start, 0)), 0)::int as total_trophies_push,
  coalesce(sum(case when greatest(m.trophies_end - m.trophies_start, 0) >= css.big_objective_trophies then 3 when greatest(m.trophies_end - m.trophies_start, 0) >= (css.big_objective_trophies / 2.0) then 1 else 0 end), 0)::int as total_points,
  count(m.id)::int as members_count,
  count(*) filter (where m.status = 'inactive')::int as inactive_count
from public.clubs c
join public.club_season_settings css on css.club_id = c.id
join public.seasons s on s.id = css.season_id
left join public.memberships m on m.club_id = c.id and m.season_id = s.id
group by c.id, c.name, c.power_rank, s.id, s.name;

create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_clubs_updated_at before update on public.clubs for each row execute function public.set_updated_at();
create trigger trg_persons_updated_at before update on public.persons for each row execute function public.set_updated_at();
create trigger trg_seasons_updated_at before update on public.seasons for each row execute function public.set_updated_at();
create trigger trg_club_season_settings_updated_at before update on public.club_season_settings for each row execute function public.set_updated_at();
create trigger trg_memberships_updated_at before update on public.memberships for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.persons enable row level security;
alter table public.seasons enable row level security;
alter table public.club_season_settings enable row level security;
alter table public.memberships enable row level security;
alter table public.member_sanctions enable row level security;
alter table public.admin_logs enable row level security;

create or replace function public.can_manage_data() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'moderator'));
$$;
create or replace function public.is_admin_viewer() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin', 'moderator', 'viewer'));
$$;

create policy "clubs_select_staff" on public.clubs for select using (public.is_admin_viewer());
create policy "clubs_manage_staff" on public.clubs for all using (public.can_manage_data()) with check (public.can_manage_data());
create policy "persons_select_staff" on public.persons for select using (public.is_admin_viewer());
create policy "persons_manage_staff" on public.persons for all using (public.can_manage_data()) with check (public.can_manage_data());
create policy "seasons_select_staff" on public.seasons for select using (public.is_admin_viewer());
create policy "seasons_manage_staff" on public.seasons for all using (public.can_manage_data()) with check (public.can_manage_data());
create policy "css_select_staff" on public.club_season_settings for select using (public.is_admin_viewer());
create policy "css_manage_staff" on public.club_season_settings for all using (public.can_manage_data()) with check (public.can_manage_data());
create policy "memberships_select_staff" on public.memberships for select using (public.is_admin_viewer());
create policy "memberships_manage_staff" on public.memberships for all using (public.can_manage_data()) with check (public.can_manage_data());
create policy "sanctions_select_staff" on public.member_sanctions for select using (public.is_admin_viewer());
create policy "sanctions_manage_staff" on public.member_sanctions for all using (public.can_manage_data()) with check (public.can_manage_data());
create policy "logs_select_staff" on public.admin_logs for select using (public.can_manage_data());
create policy "logs_insert_staff" on public.admin_logs for insert with check (public.can_manage_data());

insert into public.clubs (slug, name, color_theme, power_rank, max_members)
values
  ('prairie-etoilee', 'Prairie Étoilée', 'orange', 1, 30),
  ('prairie-celeste', 'Prairie Céleste', 'green', 2, 30),
  ('prairie-fleurie', 'Prairie Fleurie', 'white', 3, 30),
  ('prairie-gelee', 'Prairie Gelée', 'orange', 4, 30),
  ('prairie-brulee', 'Prairie Brûlée', 'green', 5, 30),
  ('prairie-sauvage', 'Prairie Sauvage', 'white', 6, 30),
  ('mini-prairie', 'Mini Prairie', 'orange', 7, 30)
on conflict (name) do update
set slug = excluded.slug, color_theme = excluded.color_theme, power_rank = excluded.power_rank, max_members = excluded.max_members;

insert into public.seasons (name, season_number, status)
values ('Saison actuelle', 1, 'active')
on conflict (name) do update set season_number = excluded.season_number, status = excluded.status;

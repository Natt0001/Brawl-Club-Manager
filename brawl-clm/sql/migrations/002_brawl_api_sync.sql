alter table if exists public.clubs
  add column if not exists club_tag text unique;

alter table if exists public.persons
  add column if not exists display_name text;

drop index if exists idx_persons_game_name_tag_unique;
create unique index if not exists idx_persons_game_name_tag_unique
on public.persons (game_name, coalesce(game_tag, ''));

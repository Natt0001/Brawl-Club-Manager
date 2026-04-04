do $$
begin
  alter type member_status add value if not exists 'left';
exception
  when duplicate_object then null;
end $$;

comment on type member_status is 'active = membre actuel, inactive = membre toujours présent mais signalé inactif par le staff, left = ex-membre de la saison';

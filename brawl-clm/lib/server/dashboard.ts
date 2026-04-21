import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { StaffContext } from '@/lib/server/auth';

export type Club = {
  id: string;
  name: string;
  color: string;
  objective: number;
  bigObjective: number;
  president: string;
  vicePresidents: string;
  powerRank: number;
  clubTag?: string;
};

export type Player = {
  id: string;
  name: string;
  role: 'Président' | 'Vice-président' | 'Membre';
  clubId: string;
  current: number;
  end: number;
  active: boolean;
  warnings: number;
  notes: string;
  lastSeen: string;
  seasonHistory: number[];
  isNew: boolean;
};

export type AdminLogEntry = { id: string; message: string; createdAt: string };
export type SeasonOption = {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'closed' | 'archived';
  seasonNumber?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
};
export type RankingTrophiesRow = { membershipId: string; playerName: string; role: Player['role']; clubName: string; trophiesPush: number };
export type RankingPointsRow = { membershipId: string; playerName: string; role: Player['role']; clubName: string; points: number; trophiesPush: number };
export type SyncStatus = {
  lastSyncAt: string | null;
  nextScheduledSyncAt: string | null;
  syncIntervalMinutes: number | null;
};

type MembershipStatus = 'active' | 'inactive' | 'left';

type StaffActor = StaffContext | null | undefined;

function roleToFront(role: string): Player['role'] {
  if (role === 'president') return 'Président';
  if (role === 'vice_president') return 'Vice-président';
  return 'Membre';
}

function roleToDb(role: Player['role']) {
  if (role === 'Président') return 'president';
  if (role === 'Vice-président') return 'vice_president';
  return 'member';
}

function formatLastSeen(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
}

function extractPersonName(person: any): string {
  if (!person) return '—';
  if (Array.isArray(person)) {
    const first = person[0];
    return first?.display_name ?? first?.game_name ?? '—';
  }
  return person.display_name ?? person.game_name ?? '—';
}

function calculatePoints(push: number, objective: number, bigObjective: number) {
  if (bigObjective > 0 && push >= bigObjective) return 3;
  if (bigObjective > 0 && push >= bigObjective / 2) return 1;
  return 0;
}

function isVisibleDashboardStatus(status: string | null | undefined) {
  return status !== 'left';
}

function actorLabel(actor?: StaffActor) {
  if (!actor) return 'Staff inconnu';
  return actor.displayName?.trim() || actor.email || actor.userId;
}

const NEW_BADGE_BASELINE_AT = new Date('2026-04-04T00:00:00.000Z').getTime();
const NEW_BADGE_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;
const FIRST_JOIN_TOLERANCE_MS = 24 * 60 * 60 * 1000;

function getNewBadgeMeta(membershipCreatedAtRaw?: string | null, personCreatedAtRaw?: string | null) {
  const membershipCreatedAt = membershipCreatedAtRaw ? new Date(membershipCreatedAtRaw) : null;
  const personCreatedAt = personCreatedAtRaw ? new Date(personCreatedAtRaw) : null;

  const membershipTime = membershipCreatedAt?.getTime() ?? NaN;
  const personTime = personCreatedAt?.getTime() ?? NaN;

  const hasMembershipDate = Number.isFinite(membershipTime);
  const hasPersonDate = Number.isFinite(personTime);
  const isRecentMembership = hasMembershipDate && Date.now() - membershipTime <= NEW_BADGE_WINDOW_MS;
  const isFirstJoinWindow =
    hasMembershipDate &&
    hasPersonDate &&
    Math.abs(membershipTime - personTime) <= FIRST_JOIN_TOLERANCE_MS;
  const isAfterBaseline = hasMembershipDate && membershipTime >= NEW_BADGE_BASELINE_AT;

  return {
    isNew: Boolean(isRecentMembership && isFirstJoinWindow && isAfterBaseline),
    joinedAt: hasMembershipDate ? membershipCreatedAtRaw ?? null : null,
  };
}

function getNextDailyCronUtc(hourUtc: number, minuteUtc: number) {
  const now = new Date();

  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hourUtc,
      minuteUtc,
      0,
      0,
    ),
  );

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.toISOString();
}

async function insertAdminLog(input: {
  entityType: string;
  entityId?: string | null;
  action: string;
  message: string;
  actor?: StaffActor;
  payloadBefore?: unknown;
  payloadAfter?: unknown;
}) {
  const client = getSupabaseServerClient();
  const { error } = await client.from('admin_logs').insert({
    actor_id: input.actor?.userId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    message: input.message,
    payload_before: input.payloadBefore ?? null,
    payload_after: input.payloadAfter ?? null,
  });
  if (error) throw error;
}

export async function getActiveSeasonServer(): Promise<SeasonOption> {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('seasons')
    .select('id,name,status,season_number,starts_at,ends_at')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    status: data.status,
    seasonNumber: data.season_number,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
  };
}

export async function getClubsForSeasonServer(seasonId: string): Promise<Club[]> {
  const client = getSupabaseServerClient();

  const [
    { data: clubs, error: clubsError },
    { data: settings, error: settingsError },
    { data: memberships, error: membershipsError },
  ] = await Promise.all([
    client.from('clubs').select('id,name,color_theme,power_rank,club_tag').eq('is_active', true).order('power_rank'),
    client.from('club_season_settings').select('club_id,objective_trophies,big_objective_trophies').eq('season_id', seasonId),
    client.from('memberships').select('club_id,role,status,person:persons(display_name,game_name)').eq('season_id', seasonId),
  ]);

  if (clubsError) throw clubsError;
  if (settingsError) throw settingsError;
  if (membershipsError) throw membershipsError;

  const visibleMemberships = (memberships ?? []).filter((m: any) => isVisibleDashboardStatus(m.status));

  return (clubs ?? []).map((club: any) => {
    const setting = (settings ?? []).find((s: any) => s.club_id === club.id);
    const president = extractPersonName(
      visibleMemberships.find((m: any) => m.club_id === club.id && m.role === 'president')?.person,
    );
    const vicePresidents = visibleMemberships
      .filter((m: any) => m.club_id === club.id && m.role === 'vice_president')
      .map((m: any) => extractPersonName(m.person))
      .filter((name: string) => name !== '—')
      .join(', ');

    return {
      id: club.id,
      name: club.name,
      color: club.color_theme ?? 'orange',
      objective: Number(setting?.objective_trophies ?? 0),
      bigObjective: Number(setting?.big_objective_trophies ?? 0),
      president,
      vicePresidents,
      powerRank: Number(club.power_rank ?? 0),
      clubTag: club.club_tag ?? undefined,
    };
  });
}

export async function getPlayersForSeasonServer(seasonId: string): Promise<Player[]> {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('memberships')
    .select(`
      id,
      club_id,
      role,
      status,
      trophies_start,
      current_trophies,
      peak_trophies,
      trophies_end,
      created_at,
      last_seen_at,
      internal_notes,
      person:persons (
        display_name,
        game_name,
        created_at
      )
    `)
    .eq('season_id', seasonId)
    .order('club_id');

  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => isVisibleDashboardStatus(row.status))
    .map((row: any) => {
      const newBadgeMeta = getNewBadgeMeta(row.created_at, row.person?.created_at);

      return {
        id: row.id,
        name: extractPersonName(row.person),
        role: roleToFront(row.role),
        clubId: row.club_id,
        current: Number(row.trophies_start ?? 0),
        end: Number(row.peak_trophies ?? row.current_trophies ?? row.trophies_end ?? row.trophies_start ?? 0),
        active: row.status === 'active',
        warnings: 0,
        notes: row.internal_notes ?? '',
        lastSeen: formatLastSeen(row.last_seen_at),
        seasonHistory: [],
        isNew: newBadgeMeta.isNew,
      };
    });
}

export async function getAdminLogsServer(limit = 20): Promise<AdminLogEntry[]> {
  const client = getSupabaseServerClient();
  const { data, error } = await client.from('admin_logs').select('id,message,created_at').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ id: row.id, message: row.message, createdAt: row.created_at }));
}

export async function getTrophiesRankingServer(seasonId: string, limit = 10): Promise<RankingTrophiesRow[]> {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('memberships')
    .select(`id,role,status,push_cached,club:clubs(name),person:persons(display_name,game_name)`)
    .eq('season_id', seasonId)
    .neq('status', 'left')
    .order('push_cached', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    membershipId: row.id,
    playerName: extractPersonName(row.person),
    role: roleToFront(row.role),
    clubName: Array.isArray(row.club) ? row.club[0]?.name ?? '—' : row.club?.name ?? '—',
    trophiesPush: Number(row.push_cached ?? 0),
  }));
}

export async function getPointsRankingServer(seasonId: string, limit = 50): Promise<RankingPointsRow[]> {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('memberships')
    .select(`id,role,status,push_cached,points_cached,club:clubs(name),person:persons(display_name,game_name)`)
    .eq('season_id', seasonId)
    .neq('status', 'left')
    .order('points_cached', { ascending: false })
    .order('push_cached', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    membershipId: row.id,
    playerName: extractPersonName(row.person),
    role: roleToFront(row.role),
    clubName: Array.isArray(row.club) ? row.club[0]?.name ?? '—' : row.club?.name ?? '—',
    points: Number(row.points_cached ?? 0),
    trophiesPush: Number(row.push_cached ?? 0),
  }));
}

export async function exportSeasonRowsServer(seasonId: string) {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('membership_stats')
    .select(`
      membership_id, person_id, club_id, season_id, role, status,
      game_name, display_name, game_tag, club_name, club_tag, season_name,
      objective_trophies, big_objective_trophies,
      trophies_start, trophies_end, current_trophies, peak_trophies,
      trophies_push, objective_points, warning_count,
      last_seen_at, last_synced_at, internal_notes
    `)
    .eq('season_id', seasonId)
    .order('club_name', { ascending: true });
  if (error) throw error;

  const { data: membershipMetaRows, error: membershipMetaError } = await client
    .from('memberships')
    .select(`id,created_at,person:persons(created_at)`)
    .eq('season_id', seasonId);
  if (membershipMetaError) throw membershipMetaError;

  const membershipMeta = new Map(
    (membershipMetaRows ?? []).map((row: any) => {
      const meta = getNewBadgeMeta(row.created_at, row.person?.created_at);
      return [row.id, meta] as const;
    }),
  );

  return (data ?? []).map((row: any) => {
    const meta = membershipMeta.get(row.membership_id) ?? { isNew: false, joinedAt: null };

    return {
      membership_id: row.membership_id,
      season_id: row.season_id,
      club_id: row.club_id,
      club_name: row.club_name ?? 'Club inconnu',
      player_id: row.person_id,
      player_name: row.display_name || row.game_name || 'Joueur inconnu',
      role: row.role === 'president' ? 'Président' : row.role === 'vice_president' ? 'Vice-président' : 'Membre',
      trophies_start: Number(row.trophies_start ?? 0),
      trophies_live: Number(row.current_trophies ?? row.trophies_end ?? 0),
      trophies_end: Number(row.trophies_end ?? 0),
      peak_trophies: Number(row.peak_trophies ?? 0),
      trophies_push: Number(row.trophies_push ?? 0),
      notes: row.internal_notes ?? '',
      objective_trophies: Number(row.objective_trophies ?? 0),
      big_objective_trophies: Number(row.big_objective_trophies ?? 0),
      objective_points: Number(row.objective_points ?? 0),
      game_tag: row.game_tag ?? '',
      status: (row.status ?? 'active') as MembershipStatus,
      is_new: meta.isNew,
      joined_at: meta.joinedAt,
    };
  });
}

export async function getSyncStatusServer(): Promise<SyncStatus> {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('admin_logs')
    .select('created_at')
    .eq('entity_type', 'brawl_sync')
    .eq('action', 'sync')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const lastSyncAt = data?.created_at ?? null;

  return {
    lastSyncAt,
    nextScheduledSyncAt: getNextDailyCronUtc(10, 0),
    syncIntervalMinutes: null,
  };
}

export async function loadDashboardDataServer() {
  const activeSeason = await getActiveSeasonServer();
  const [clubs, players, logs, trophiesRanking, pointsRanking, syncStatus] = await Promise.all([
    getClubsForSeasonServer(activeSeason.id),
    getPlayersForSeasonServer(activeSeason.id),
    getAdminLogsServer(20),
    getTrophiesRankingServer(activeSeason.id, 10),
    getPointsRankingServer(activeSeason.id, 50),
    getSyncStatusServer(),
  ]);

  return { activeSeason, clubs, players, logs, trophiesRanking, pointsRanking, syncStatus };
}

export async function saveClubSettingsServer(
  input: { clubId: string; seasonId: string; name: string; powerRank: number; objective: number; bigObjective: number; clubTag?: string },
  actor?: StaffActor,
) {
  const client = getSupabaseServerClient();
  const { data: before } = await client.from('clubs').select('id,name,power_rank,club_tag').eq('id', input.clubId).maybeSingle();

  const { error: clubError } = await client.from('clubs').update({ name: input.name, power_rank: input.powerRank, club_tag: input.clubTag ?? null }).eq('id', input.clubId);
  if (clubError) throw clubError;

  const { error: settingsError } = await client
    .from('club_season_settings')
    .upsert({ club_id: input.clubId, season_id: input.seasonId, objective_trophies: input.objective, big_objective_trophies: input.bigObjective }, { onConflict: 'season_id,club_id' });
  if (settingsError) throw settingsError;

  await insertAdminLog({
    actor,
    entityType: 'club',
    entityId: input.clubId,
    action: 'update',
    message: `${actorLabel(actor)} a modifié le club ${input.name}`,
    payloadBefore: before,
    payloadAfter: input,
  });
}

export async function savePlayerMembershipServer(
  input: { membershipId: string; name?: string; role: Player['role']; current: number; end: number; active: boolean; notes: string },
  actor?: StaffActor,
) {
  const client = getSupabaseServerClient();
  const startTrophies = Math.max(0, Number(input.current || 0));
  const currentOrPeakTrophies = Math.max(0, Number(input.end || 0));
  const peakTrophies = Math.max(startTrophies, currentOrPeakTrophies);
  const push = Math.max(0, peakTrophies - startTrophies);

  const { data: membership, error: membershipError } = await client
    .from('memberships')
    .select('club_id,season_id,person_id,role,status,trophies_start,current_trophies,peak_trophies,internal_notes')
    .eq('id', input.membershipId)
    .single();
  if (membershipError) throw membershipError;

  const { data: settings, error: settingsError } = await client
    .from('club_season_settings')
    .select('objective_trophies,big_objective_trophies')
    .eq('club_id', (membership as any).club_id)
    .eq('season_id', (membership as any).season_id)
    .single();
  if (settingsError) throw settingsError;

  const objective = Number(settings?.objective_trophies ?? 0);
  const bigObjective = Number(settings?.big_objective_trophies ?? 0);
  const points = calculatePoints(push, objective, bigObjective);

  if (typeof input.name === 'string' && input.name.trim()) {
    const cleanName = input.name.trim();
    const { error: personError } = await client.from('persons').update({ game_name: cleanName, display_name: cleanName }).eq('id', (membership as any).person_id);
    if (personError) throw personError;
  }

  const { error } = await client
    .from('memberships')
    .update({
      role: roleToDb(input.role),
      trophies_start: startTrophies,
      trophies_end: currentOrPeakTrophies,
      current_trophies: currentOrPeakTrophies,
      peak_trophies: peakTrophies,
      push_cached: push,
      points_cached: points,
      status: input.active ? 'active' : 'inactive',
      internal_notes: input.notes,
      last_seen_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', input.membershipId);
  if (error) throw error;

  await insertAdminLog({
    actor,
    entityType: 'membership',
    entityId: input.membershipId,
    action: 'update',
    message: `${actorLabel(actor)} a modifié ${input.name?.trim() || input.membershipId}`,
    payloadBefore: membership,
    payloadAfter: {
      role: input.role,
      trophies_start: startTrophies,
      trophies_live: currentOrPeakTrophies,
      push_cached: push,
      points_cached: points,
      active: input.active,
      notes: input.notes,
    },
  });
}

export async function createPlayerWithMembershipServer(
  input: { seasonId: string; clubId: string; name: string; role?: Player['role'] },
  actor?: StaffActor,
) {
  const client = getSupabaseServerClient();
  const cleanName = input.name.trim();

  const { data: person, error: personError } = await client
    .from('persons')
    .insert({ game_name: cleanName, display_name: cleanName })
    .select('id')
    .single();
  if (personError) throw personError;

  const { data, error } = await client
    .from('memberships')
    .insert({
      person_id: (person as any).id,
      club_id: input.clubId,
      season_id: input.seasonId,
      role: roleToDb(input.role ?? 'Membre'),
      status: 'active',
      trophies_start: 0,
      trophies_end: 0,
      current_trophies: 0,
      peak_trophies: 0,
      push_cached: 0,
      points_cached: 0,
      internal_notes: '',
      last_seen_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;

  await insertAdminLog({
    actor,
    entityType: 'membership',
    entityId: (data as any).id,
    action: 'create',
    message: `${actorLabel(actor)} a ajouté ${cleanName}`,
    payloadAfter: input,
  });

  return data as { id: string };
}

export async function deleteMembershipServer(membershipId: string, actor?: StaffActor) {
  const client = getSupabaseServerClient();
  const { data: membership } = await client
    .from('memberships')
    .select('id, person:persons(display_name,game_name)')
    .eq('id', membershipId)
    .maybeSingle();

  const memberName = extractPersonName((membership as any)?.person);
  const { error } = await client.from('memberships').delete().eq('id', membershipId);
  if (error) throw error;

  await insertAdminLog({
    actor,
    entityType: 'membership',
    entityId: membershipId,
    action: 'delete',
    message: `${actorLabel(actor)} a supprimé ${memberName}`,
  });
}

export async function saveSeasonServer(input: { seasonId: string; name: string }, actor?: StaffActor) {
  const client = getSupabaseServerClient();
  const cleanName = input.name.trim();
  if (!cleanName) throw new Error('Nom de saison invalide');

  const { data: before } = await client.from('seasons').select('id,name,season_number,status').eq('id', input.seasonId).maybeSingle();
  const { error } = await client.from('seasons').update({ name: cleanName }).eq('id', input.seasonId);
  if (error) throw error;

  await insertAdminLog({
    actor,
    entityType: 'season',
    entityId: input.seasonId,
    action: 'rename',
    message: `${actorLabel(actor)} a renommé la saison en ${cleanName}`,
    payloadBefore: before,
    payloadAfter: { seasonId: input.seasonId, name: cleanName },
  });
}

export async function closeAndOpenNextSeasonServer(actor?: StaffActor) {
  const client = getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const activeSeason = await getActiveSeasonServer();
  const nextSeasonNumber = Number(activeSeason.seasonNumber ?? 0) + 1;

  const { data: previousSettings, error: settingsError } = await client
    .from('club_season_settings')
    .select('club_id, objective_trophies, big_objective_trophies')
    .eq('season_id', activeSeason.id);
  if (settingsError) throw settingsError;

  const { error: closeError } = await client
    .from('seasons')
    .update({ status: 'closed', ends_at: nowIso })
    .eq('id', activeSeason.id);
  if (closeError) throw closeError;

  const { data: newSeason, error: newSeasonError } = await client
    .from('seasons')
    .insert({
      name: `Saison ${nextSeasonNumber}`,
      season_number: nextSeasonNumber,
      starts_at: nowIso,
      ends_at: null,
      status: 'active',
    })
    .select('id,name,status,season_number,starts_at,ends_at')
    .single();
  if (newSeasonError || !newSeason) throw new Error(newSeasonError?.message ?? 'Impossible de créer la nouvelle saison');

  if ((previousSettings ?? []).length > 0) {
    const { error: copyError } = await client.from('club_season_settings').insert(
      previousSettings.map((row: any) => ({
        season_id: newSeason.id,
        club_id: row.club_id,
        objective_trophies: row.objective_trophies ?? 0,
        big_objective_trophies: row.big_objective_trophies ?? 0,
      })),
    );
    if (copyError) throw copyError;
  }

  const previousSeason: SeasonOption = { ...activeSeason, status: 'closed', endsAt: nowIso };
  const nextSeason: SeasonOption = {
    id: newSeason.id,
    name: newSeason.name,
    status: newSeason.status,
    seasonNumber: newSeason.season_number,
    startsAt: newSeason.starts_at,
    endsAt: newSeason.ends_at,
  };

  await insertAdminLog({
    actor,
    entityType: 'season',
    entityId: activeSeason.id,
    action: 'close_and_open',
    message: `${actorLabel(actor)} a clôturé ${activeSeason.name} et ouvert ${newSeason.name}`,
    payloadBefore: previousSeason,
    payloadAfter: nextSeason,
  });

  return { previousSeason, newSeason: nextSeason };
}

import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { StaffContext } from '@/lib/server/auth';
import { getClubByTag, getPlayerByTag, mapBrawlRoleToDb, normalizeBrawlTag } from '@/lib/brawl-stars/api';

export type SyncSummary = {
  seasonId: string;
  processedClubs: number;
  processedMembers: number;
  createdPersons: number;
  createdMemberships: number;
  updatedMemberships: number;
  inactivatedMemberships: number;
};

type ClubRow = {
  id: string;
  name: string;
  club_tag: string | null;
  power_rank: number;
};

type PersonRow = { id: string; game_tag: string | null; game_name: string };


type StaffActor = StaffContext | null | undefined;

function actorLabel(actor?: StaffActor) {
  if (!actor) return 'Staff inconnu';
  return actor.displayName?.trim() || actor.email || actor.userId;
}

type MembershipRow = {
  id: string;
  person_id: string;
  club_id: string;
  season_id: string;
  trophies_start: number;
  trophies_end: number;
  current_trophies?: number | null;
  peak_trophies?: number | null;
  push_cached?: number | null;
  points_cached?: number | null;
  status: string;
};

function calculatePoints(push: number, objective: number, bigObjective: number) {
  if (bigObjective > 0 && push >= bigObjective) return 3;
  if (bigObjective > 0 && push >= bigObjective / 2) return 1;
  return 0;
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  });

  await Promise.all(workers);
}

export async function syncBrawlDataForActiveSeason(actor?: StaffActor): Promise<SyncSummary> {
  const supabase = getSupabaseServerClient();

  const { data: activeSeason, error: seasonError } = await supabase
    .from('seasons')
    .select('id, name, status')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (seasonError || !activeSeason) {
    throw new Error(`Active season not found: ${seasonError?.message ?? 'unknown'}`);
  }

  const { data: clubs, error: clubsError } = await supabase
    .from('clubs')
    .select('id, name, club_tag, power_rank')
    .eq('is_active', true)
    .not('club_tag', 'is', null)
    .order('power_rank');

  if (clubsError) {
    throw new Error(`Failed loading clubs: ${clubsError.message}`);
  }

  const summary: SyncSummary = {
    seasonId: activeSeason.id,
    processedClubs: 0,
    processedMembers: 0,
    createdPersons: 0,
    createdMemberships: 0,
    updatedMemberships: 0,
    inactivatedMemberships: 0,
  };

  for (const club of (clubs ?? []) as ClubRow[]) {
    if (!club.club_tag) continue;

    const remoteClub = await getClubByTag(club.club_tag);
    const normalizedClubTag = normalizeBrawlTag(remoteClub.tag);

    await supabase
      .from('clubs')
      .update({ club_tag: normalizedClubTag, name: remoteClub.name })
      .eq('id', club.id);

    const { data: clubSettings, error: clubSettingsError } = await supabase
      .from('club_season_settings')
      .select('objective_trophies,big_objective_trophies')
      .eq('club_id', club.id)
      .eq('season_id', activeSeason.id)
      .maybeSingle();

    if (clubSettingsError) {
      throw new Error(`Failed loading club settings for ${club.name}: ${clubSettingsError.message}`);
    }

    const objective = Number((clubSettings as any)?.objective_trophies ?? 0);
    const bigObjective = Number((clubSettings as any)?.big_objective_trophies ?? 0);
    const seenMembershipTags = new Set<string>();

    await runWithConcurrency(remoteClub.members, 5, async (member) => {
      const normalizedPlayerTag = normalizeBrawlTag(member.tag);
      seenMembershipTags.add(normalizedPlayerTag);
      summary.processedMembers += 1;

      const playerProfile = await getPlayerByTag(normalizedPlayerTag);

      const { data: existingPerson, error: personLookupError } = await supabase
        .from('persons')
        .select('id, game_tag, game_name')
        .eq('game_tag', normalizedPlayerTag)
        .maybeSingle();

      if (personLookupError) {
        throw new Error(`Person lookup failed for ${normalizedPlayerTag}: ${personLookupError.message}`);
      }

      let personId = (existingPerson as PersonRow | null)?.id ?? null;

      if (!personId) {
        const { data: createdPerson, error: createPersonError } = await supabase
          .from('persons')
          .insert({
            game_name: playerProfile.name,
            game_tag: normalizedPlayerTag,
            display_name: playerProfile.name,
          })
          .select('id')
          .single();

        if (createPersonError || !createdPerson) {
          throw new Error(`Person create failed for ${normalizedPlayerTag}: ${createPersonError?.message ?? 'unknown'}`);
        }

        personId = createdPerson.id;
        summary.createdPersons += 1;
      } else {
        await supabase
          .from('persons')
          .update({ game_name: playerProfile.name, display_name: playerProfile.name })
          .eq('id', personId);
      }

      const { data: membership, error: membershipLookupError } = await supabase
        .from('memberships')
        .select('id, person_id, club_id, season_id, trophies_start, trophies_end, current_trophies, peak_trophies, push_cached, points_cached, status')
        .eq('person_id', personId)
        .eq('club_id', club.id)
        .eq('season_id', activeSeason.id)
        .maybeSingle();

      if (membershipLookupError) {
        throw new Error(`Membership lookup failed for ${normalizedPlayerTag}: ${membershipLookupError.message}`);
      }

      if (!membership) {
        const { error: createMembershipError } = await supabase.from('memberships').insert({
          person_id: personId,
          club_id: club.id,
          season_id: activeSeason.id,
          role: mapBrawlRoleToDb(member.role),
          status: 'active',
          trophies_start: playerProfile.trophies,
          trophies_end: playerProfile.trophies,
          current_trophies: playerProfile.trophies,
          peak_trophies: playerProfile.trophies,
          push_cached: 0,
          points_cached: 0,
          last_seen_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          internal_notes: '',
        });

        if (createMembershipError) {
          throw new Error(`Membership create failed for ${normalizedPlayerTag}: ${createMembershipError.message}`);
        }

        summary.createdMemberships += 1;
      } else {
        const existing = membership as MembershipRow;
        const startTrophies = Number(existing.trophies_start ?? 0);
        const liveTrophies = Number(playerProfile.trophies ?? 0);
        const previousPeak = Number(existing.peak_trophies ?? existing.current_trophies ?? existing.trophies_end ?? startTrophies);
        const peakTrophies = Math.max(startTrophies, previousPeak, liveTrophies);
        const pushCached = Math.max(0, peakTrophies - startTrophies);
        const pointsCached = calculatePoints(pushCached, objective, bigObjective);

        const { error: updateMembershipError } = await supabase
          .from('memberships')
          .update({
            role: mapBrawlRoleToDb(member.role),
            status: 'active',
            trophies_end: liveTrophies,
            current_trophies: liveTrophies,
            peak_trophies: peakTrophies,
            push_cached: pushCached,
            points_cached: pointsCached,
            last_seen_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateMembershipError) {
          throw new Error(`Membership update failed for ${normalizedPlayerTag}: ${updateMembershipError.message}`);
        }

        summary.updatedMemberships += 1;
      }
    });

    const { data: clubMemberships, error: staleMembershipsError } = await supabase
      .from('memberships')
      .select('id, person_id, status, persons!inner(game_tag)')
      .eq('club_id', club.id)
      .eq('season_id', activeSeason.id)
      .neq('status', 'left');

    if (staleMembershipsError) {
      throw new Error(`Membership stale check failed for club ${club.name}: ${staleMembershipsError.message}`);
    }

    for (const row of clubMemberships ?? []) {
      const gameTag = normalizeBrawlTag((row as any).persons.game_tag ?? '');
      if (!gameTag || seenMembershipTags.has(gameTag)) continue;

      const { error: leftError } = await supabase
        .from('memberships')
        .update({ status: 'left' })
        .eq('id', (row as any).id);

      if (leftError) {
        throw new Error(`Failed to mark ex-member ${gameTag}: ${leftError.message}`);
      }

      summary.inactivatedMemberships += 1;
    }

    summary.processedClubs += 1;
  }

  await supabase.from('admin_logs').insert({
    actor_id: actor?.userId ?? null,
    entity_type: 'brawl_sync',
    action: 'sync',
    message: `${actorLabel(actor)} a lancé la sync Brawl Stars : ${summary.processedClubs} clubs, ${summary.processedMembers} membres, ${summary.createdMemberships} memberships créés, ${summary.updatedMemberships} mis à jour, ${summary.inactivatedMemberships} ex-membres détectés`,
    payload_after: summary,
  });

  return summary;
}

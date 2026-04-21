import { supabase } from '@/lib/supabase/client';

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
export type StaffMe = {
  isLoggedIn: boolean;
  role: 'owner' | 'moderator' | 'viewer';
  displayName: string | null;
  email: string | null;
  canModerate: boolean;
};
export type SyncStatus = {
  lastSyncAt: string | null;
  nextScheduledSyncAt: string | null;
  syncIntervalMinutes: number;
};

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(input, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const json = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error ?? `API error on ${input}`);
  }
  return (json?.data ?? json?.summary ?? json) as T;
}

export async function getStaffMe() {
  return apiFetch<StaffMe>(`/api/profile/me?t=${Date.now()}`);
}

export async function saveStaffDisplayName(displayName: string) {
  await apiFetch('/api/profile/save', { method: 'POST', body: JSON.stringify({ displayName }) });
}

export async function signInStaffWithGoogle() {
  if (!supabase) throw new Error('Supabase non configuré');
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw error;
}

export async function signOutStaff() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function loadDashboardData() {
  return apiFetch<{
    activeSeason: SeasonOption;
    clubs: Club[];
    players: Player[];
    logs: AdminLogEntry[];
    trophiesRanking: RankingTrophiesRow[];
    pointsRanking: RankingPointsRow[];
    syncStatus: SyncStatus;
  }>(`/api/dashboard?t=${Date.now()}`);
}

export async function saveClubSettings(input: { clubId: string; seasonId: string; name: string; powerRank: number; objective: number; bigObjective: number; clubTag?: string }) {
  await apiFetch('/api/clubs/save', { method: 'POST', body: JSON.stringify(input) });
}

export async function savePlayerMembership(input: { membershipId: string; name?: string; role: Player['role']; current: number; end: number; active: boolean; notes: string }) {
  await apiFetch('/api/memberships/save', { method: 'POST', body: JSON.stringify(input) });
}

export async function createPlayerWithMembership(input: { seasonId: string; clubId: string; name: string; role?: Player['role'] }) {
  return apiFetch<{ id: string }>('/api/memberships/create', { method: 'POST', body: JSON.stringify(input) });
}

export async function deleteMembership(membershipId: string) {
  await apiFetch('/api/memberships/delete', { method: 'POST', body: JSON.stringify({ membershipId }) });
}

export async function syncBrawlStars() {
  return apiFetch<{ seasonId: string; processedClubs: number; processedMembers: number; createdPersons: number; createdMemberships: number; updatedMemberships: number; inactivatedMemberships: number }>('/api/brawl/sync', { method: 'POST' });
}

export async function closeAndOpenNextSeason() {
  return apiFetch<{ previousSeason: SeasonOption; newSeason: SeasonOption }>('/api/seasons/manage', { method: 'POST' });
}

export async function saveSeason(input: { seasonId: string; name: string }) {
  await apiFetch('/api/seasons/save', { method: 'POST', body: JSON.stringify(input) });
}

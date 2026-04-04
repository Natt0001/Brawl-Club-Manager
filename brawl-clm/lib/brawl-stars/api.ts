const baseUrl = 'https://bsproxy.royaleapi.dev/v1';

export type BrawlClubMember = {
  tag: string;
  name: string;
  role: 'member' | 'senior' | 'vicePresident' | 'president';
  trophies: number;
};

export type BrawlClubResponse = {
  tag: string;
  name: string;
  members: BrawlClubMember[];
};

export type BrawlPlayerResponse = {
  tag: string;
  name: string;
  trophies: number;
};

export function normalizeBrawlTag(tag: string) {
  return tag.trim().replace(/^#/, '').toUpperCase();
}

function getBrawlApiToken() {
  const token = process.env.BRAWL_STARS_API_TOKEN;
  if (!token) {
    throw new Error('Missing BRAWL_STARS_API_TOKEN in environment');
  }
  return token;
}

async function brawlFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${getBrawlApiToken()}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brawl API ${response.status} on ${path}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function getClubByTag(tag: string) {
  const normalized = normalizeBrawlTag(tag);
  return brawlFetch<BrawlClubResponse>(`/clubs/%23${encodeURIComponent(normalized)}`);
}

export async function getPlayerByTag(tag: string) {
  const normalized = normalizeBrawlTag(tag);
  return brawlFetch<BrawlPlayerResponse>(`/players/%23${encodeURIComponent(normalized)}`);
}

export function mapBrawlRoleToDb(role: BrawlClubMember['role']) {
  switch (role) {
    case 'president':
      return 'president';
    case 'vicePresident':
      return 'vice_president';
    default:
      return 'member';
  }
}

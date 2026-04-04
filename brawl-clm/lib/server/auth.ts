import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export type StaffRole = 'owner' | 'moderator' | 'viewer';

export type StaffContext = {
  userId: string;
  email: string | null;
  role: StaffRole;
  displayName: string | null;
};

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

export async function getRequestStaffContext(request: NextRequest): Promise<StaffContext | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = getBearerToken(request);

  if (!url || !anonKey || !token) return null;

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) return null;

  const service = getSupabaseServerClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    role: (profile?.role ?? 'viewer') as StaffRole,
    displayName: profile?.display_name ?? null,
  };
}

export async function requireStaff(request: NextRequest) {
  const staff = await getRequestStaffContext(request);
  if (!staff) {
    throw new Error('Connexion staff requise');
  }
  if (!['owner', 'moderator'].includes(staff.role)) {
    throw new Error('Accès réservé au staff');
  }
  return staff;
}

import { NextRequest, NextResponse } from 'next/server';
import { getRequestStaffContext } from '@/lib/server/auth';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const staff = await getRequestStaffContext(request);

    if (!staff || !['owner', 'moderator'].includes(staff.role)) {
      return NextResponse.json({ ok: false, error: 'Accès réservé au staff' }, { status: 403 });
    }

    const body = await request.json();
    const displayName = String(body?.displayName ?? '').trim();

    if (!displayName || displayName.length < 2) {
      return NextResponse.json({ ok: false, error: 'Pseudo invalide' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', staff.userId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown profile save error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

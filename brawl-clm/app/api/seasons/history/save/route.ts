import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/server/auth';
import { saveSeasonHistorySnapshotServer } from '@/lib/server/dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireStaff(request);
    const body = await request.json();
    await saveSeasonHistorySnapshotServer(body, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur d'enregistrement de l'historique";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

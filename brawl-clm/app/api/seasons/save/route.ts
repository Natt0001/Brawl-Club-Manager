import { NextRequest, NextResponse } from 'next/server';
import { saveSeasonServer } from '@/lib/server/dashboard';
import { requireStaff } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaff(request);
    const body = await request.json();
    await saveSeasonServer({ seasonId: body.seasonId, name: body.name }, staff);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown season save error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

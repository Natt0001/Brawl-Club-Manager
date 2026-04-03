import { NextRequest, NextResponse } from 'next/server';
import { closeAndOpenNextSeasonServer } from '@/lib/server/dashboard';
import { requireStaff } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaff(request);
    const data = await closeAndOpenNextSeasonServer(staff);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown season management error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

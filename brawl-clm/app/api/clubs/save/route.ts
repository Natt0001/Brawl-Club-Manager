import { NextRequest, NextResponse } from 'next/server';
import { saveClubSettingsServer } from '@/lib/server/dashboard';
import { requireStaff } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaff(request);
    const body = await request.json();
    await saveClubSettingsServer(body, staff);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown save club error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

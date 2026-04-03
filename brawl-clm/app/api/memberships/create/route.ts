import { NextRequest, NextResponse } from 'next/server';
import { createPlayerWithMembershipServer } from '@/lib/server/dashboard';
import { requireStaff } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaff(request);
    const body = await request.json();
    const data = await createPlayerWithMembershipServer(body, staff);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown create membership error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

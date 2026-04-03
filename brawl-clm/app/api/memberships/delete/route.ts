import { NextRequest, NextResponse } from 'next/server';
import { deleteMembershipServer } from '@/lib/server/dashboard';
import { requireStaff } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaff(request);
    const body = await request.json();
    await deleteMembershipServer(body.membershipId, staff);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown delete membership error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

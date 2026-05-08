import { NextRequest, NextResponse } from 'next/server';
import { requirePointsStaff } from '@/lib/server/auth';
import { adjustMembershipPointsServer } from '@/lib/server/dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePointsStaff(request);
    const body = await request.json();
    await adjustMembershipPointsServer(
      {
        seasonId: body.seasonId,
        membershipId: body.membershipId,
        deltaPoints: Number(body.deltaPoints),
        reason: body.reason,
      },
      actor,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur de modification des points';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

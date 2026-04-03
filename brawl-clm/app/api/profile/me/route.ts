import { NextRequest, NextResponse } from 'next/server';
import { getRequestStaffContext } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const staff = await getRequestStaffContext(request);

    return NextResponse.json({
      ok: true,
      data: {
        isLoggedIn: Boolean(staff),
        role: staff?.role ?? 'viewer',
        displayName: staff?.displayName ?? null,
        email: staff?.email ?? null,
        canModerate: staff ? ['owner', 'moderator'].includes(staff.role) : false,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown profile error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

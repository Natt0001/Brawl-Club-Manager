import { NextResponse } from 'next/server';
import { loadDashboardDataServer } from '@/lib/server/dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const data = await loadDashboardDataServer();

    return NextResponse.json(
      { ok: true, data },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('DASHBOARD API ERROR:', error);

    const message = error instanceof Error ? error.message : 'Unknown dashboard error';

    return NextResponse.json(
      { ok: false, error: message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }
}
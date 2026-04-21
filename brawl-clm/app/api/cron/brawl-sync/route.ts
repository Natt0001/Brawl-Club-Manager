import { NextRequest, NextResponse } from 'next/server';
import { syncBrawlDataForActiveSeason } from '@/lib/brawl-stars/sync';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized cron call' }, { status: 401 });
  }

  try {
    const summary = await syncBrawlDataForActiveSeason();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown cron sync error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

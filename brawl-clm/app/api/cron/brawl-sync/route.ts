import { NextRequest, NextResponse } from 'next/server';
import { syncBrawlDataForActiveSeason } from '@/lib/brawl-stars/sync';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    await syncBrawlDataForActiveSeason();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { syncBrawlDataForActiveSeason } from '@/lib/brawl-stars/sync';
import { requireStaff } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaff(request);
    const summary = await syncBrawlDataForActiveSeason(staff);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

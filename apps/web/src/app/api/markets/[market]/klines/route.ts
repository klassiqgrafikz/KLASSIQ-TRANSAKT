import { NextRequest, NextResponse } from 'next/server';
import { exchangeService } from '@klassiq-transakt/exchange';

export const dynamic = 'force-dynamic';

const ALLOWED_PERIODS = new Set([1, 5, 15, 30, 60, 120, 240, 360, 720, 1440, 4320, 10080]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ market: string }> }
) {
  const { market } = await params;
  const period = parseInt(request.nextUrl.searchParams.get('period') ?? '15', 10);
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '300', 10) || 300, 500);

  if (!ALLOWED_PERIODS.has(period)) {
    return NextResponse.json({ error: `period must be one of ${[...ALLOWED_PERIODS].join(',')}` }, { status: 400 });
  }

  try {
    const klines = await exchangeService.getKlines(market, period, limit);
    const res = NextResponse.json({ market, period, klines });
    res.headers.set('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res;
  } catch (error) {
    console.error(`[api/markets/klines] ${market}/${period}:`, error);
    return NextResponse.json({ error: 'Failed to fetch klines' }, { status: 502 });
  }
}
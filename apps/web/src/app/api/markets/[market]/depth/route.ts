import { NextRequest, NextResponse } from 'next/server';
import { exchangeService } from '@klassiq-transakt/exchange';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ market: string }> }
) {
  const { market } = await params;
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10) || 20, 100);

  try {
    const depth = await exchangeService.getDepth(market, limit);
    const res = NextResponse.json(depth);
    res.headers.set('Cache-Control', 's-maxage=2, stale-while-revalidate=5');
    return res;
  } catch (error) {
    console.error(`[api/markets/depth] ${market}:`, error);
    return NextResponse.json({ error: 'Failed to fetch depth' }, { status: 502 });
  }
}
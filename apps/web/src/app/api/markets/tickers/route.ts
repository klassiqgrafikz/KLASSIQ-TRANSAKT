import { NextResponse } from 'next/server';
import { exchangeService } from '@klassiq-transakt/exchange';

export const dynamic = 'force-dynamic';

/**
 * Public market tickers — powers the terminal ticker strip + markets board.
 * Cached briefly at the edge so Quidax sees one polite client.
 */
export async function GET() {
  try {
    const tickers = await exchangeService.getAllTickers();
    const res = NextResponse.json({ tickers, at: Date.now() });
    res.headers.set('Cache-Control', 's-maxage=5, stale-while-revalidate=15');
    return res;
  } catch (error) {
    console.error('[api/markets/tickers] failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickers' },
      { status: 502 }
    );
  }
}
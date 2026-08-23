import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** GET — all wallet balances with NGN valuation */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const wallets = await exchangeService.getWallets();
    const totalNgn = wallets.reduce((sum, w) => sum + w.convertedNgn, 0);

    return NextResponse.json({
      wallets: wallets.sort((a, b) => b.convertedNgn - a.convertedNgn),
      totalNgn,
      at: Date.now(),
    });
  } catch (error) {
    console.error('[api/wallets GET]', error);
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: 'Failed to fetch wallets', detail: message.slice(0, 200) },
      { status: 502 }
    );
  }
}
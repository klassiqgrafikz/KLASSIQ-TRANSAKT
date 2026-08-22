import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const quote = await exchangeService.getRate('BTC', 'NGN');
    
    return NextResponse.json({
      rate: quote.rate,
      fee: quote.fee,
      provider: quote.provider,
      expiresAt: quote.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Fetch rate error:', error);
    return NextResponse.json({ error: 'Failed to fetch rate' }, { status: 500 });
  }
}
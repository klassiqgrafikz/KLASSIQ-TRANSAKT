import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const quoteSchema = z.object({
  btcAmount: z.number().positive().max(100),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { btcAmount } = quoteSchema.parse(body);

    // Check daily volume limit based on KYC level
    const dailyLimit = await exchangeService.getDailyVolumeLimit(session.user.kycLevel as 'NONE' | 'BASIC' | 'FULL');
    const estimatedNgn = btcAmount * 50000000; // Rough estimate for limit check
    
    if (estimatedNgn > dailyLimit) {
      return NextResponse.json(
        { error: `Daily limit exceeded. Your limit: ${(dailyLimit / 1000000).toFixed(1)}M NGN/day` },
        { status: 400 }
      );
    }

    // Get actual rate from exchange
    const quote = await exchangeService.getRate('BTC', 'NGN');
    
    return NextResponse.json({
      rate: quote.rate,
      fee: quote.fee,
      provider: quote.provider,
      expiresAt: quote.expiresAt.toISOString(),
      estimatedNgn: btcAmount * quote.rate - quote.fee,
    });
  } catch (error) {
    console.error('Quote error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to get quote' }, { status: 500 });
  }
}
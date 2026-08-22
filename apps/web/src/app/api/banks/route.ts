import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const banks = await exchangeService.getBanks();
    return NextResponse.json(banks);
  } catch (error) {
    console.error('Fetch banks error:', error);
    return NextResponse.json({ error: 'Failed to fetch banks' }, { status: 500 });
  }
}
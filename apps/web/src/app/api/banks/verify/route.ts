import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const verifySchema = z.object({
  bankCode: z.string().length(3),
  accountNumber: z.string().length(10),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bankCode, accountNumber } = verifySchema.parse(body);

    // Verify with exchange service
    const result = await exchangeService.verifyBankAccount(bankCode, accountNumber);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Verify account error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid bank code or account number' }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
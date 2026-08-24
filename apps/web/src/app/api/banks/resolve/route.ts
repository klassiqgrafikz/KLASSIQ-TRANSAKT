import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { resolveAccount } from '@/lib/paystack';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const resolveSchema = z.object({
  accountNumber: z.string().regex(/^\d{10}$/),
  bankCode: z.string().min(2).max(10),
});

/**
 * POST — resolve a Nigerian bank account holder's name.
 * Uses Paystack when PAYSTACK_SECRET_KEY is set; otherwise returns
 * { available: false } so callers fall back to manual entry.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = resolveSchema.parse(await request.json());
    const result = await resolveAccount(body.accountNumber, body.bankCode);

    if (!result) {
      return NextResponse.json(
        { available: false, reason: process.env.PAYSTACK_SECRET_KEY ? 'Account not found' : 'Resolver not configured' },
        { status: 200 }
      );
    }

    return NextResponse.json({ available: true, ...result });
  } catch (error) {
    console.error('[api/banks/resolve]', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'accountNumber must be 10 digits' }, { status: 400 });
    }
    return NextResponse.json({ available: false, reason: 'Lookup failed — enter name manually' }, { status: 200 });
  }
}
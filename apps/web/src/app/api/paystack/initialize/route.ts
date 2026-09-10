import { auth } from '@/lib/auth';
import { initializeTransaction } from '@/lib/paystack';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const initSchema = z.object({
  amountNgn: z.number().positive().max(10_000_000),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = initSchema.parse(await request.json());

    const reference = `kt-dep-${session.user.id.slice(-6)}-${Date.now()}`;
    const result = await initializeTransaction({
      email: session.user.email ?? `${session.user.id}@klassiq.local`,
      amountKobo: Math.round(body.amountNgn * 100),
      reference,
      metadata: {
        userId: session.user.id,
        purpose: 'deposit',
        ...body.metadata,
      },
      channels: ['card', 'bank'],
    });

    if (!result) {
      return NextResponse.json({ error: 'Paystack not configured' }, { status: 503 });
    }

    return NextResponse.json({
      authorizationUrl: result.authorization_url,
      accessCode: result.access_code,
      reference: result.reference,
    });
  } catch (error) {
    console.error('[api/paystack/initialize]', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to initialize payment' }, { status: 400 });
  }
}
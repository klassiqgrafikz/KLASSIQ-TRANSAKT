import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { prisma } from '@klassiq-transakt/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET ?ref=<merchant_reference>
 * Requeries Quidax for the latest on-ramp status and syncs our intent.
 * Called by the UI while the user is at their banking app.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ref = request.nextUrl.searchParams.get('ref');
  if (!ref) return NextResponse.json({ error: 'ref required' }, { status: 400 });

  try {
    const intent = await prisma.cashDepositIntent.findFirst({
      where: { merchantRef: ref, userId: session.user.id },
    });
    if (!intent) return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });

    if (['completed', 'failed'].includes(intent.status)) {
      return NextResponse.json({ status: intent.status, final: true, toCurrency: intent.toCurrency });
    }

    const remote = await exchangeService.fetchNgnOnRampStatus(ref);

    // Map provider → local; completed credits crypto to dest address
    const patch = { status: remote.status as string };
    if (remote.status === 'completed') Object.assign(patch, { status: 'completed' });

    const updated = await prisma.cashDepositIntent.update({
      where: { id: intent.id },
      data: { ...patch },
    });

    return NextResponse.json({
      status: updated.status,
      final: ['completed', 'failed'].includes(updated.status),
      toAmount: remote.toAmount,
      toCurrency: intent.toCurrency,
    });
  } catch (error) {
    console.error(`[api/ramp/status] ${ref}:`, error);
    return NextResponse.json(
      { error: 'Status check failed — will retry', lastKnown: 'awaiting_payment' },
      { status: 200 } // soft-fail so UI keeps polling
    );
  }
}
import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { prisma } from '@klassiq-transakt/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const initiateSchema = z.object({
  toCurrency: z.enum(['usdt', 'btc', 'usdc']),
  amountNgn: z.number().positive().max(50_000_000),
  network: z.string().min(2),
});

/**
 * POST — create + confirm an NGN cash-deposit intent in one call.
 * Returns the dynamic bank account the user must pay EXACTLY amount_expected to.
 * Crypto lands in the owner's own Quidax deposit address for the chosen coin.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  try {
    const body = initiateSchema.parse(await request.json());

    // Destination: owner's own deposit address on Quidax for the chosen coin
    const dest = await exchangeService.getDefaultDepositAddress(body.toCurrency);
    if (!dest?.address) {
      return NextResponse.json(
        { error: `No ${body.toCurrency.toUpperCase()} deposit address available yet — generate one under Wallets → Deposit first.` },
        { status: 400 }
      );
    }

    const merchantRef = `kt-cash-${userId.slice(-6)}-${Date.now()}`;
    const firstName = (session.user.name ?? 'KLASSIQ').split(' ')[0] || 'KLASSIQ';
    const lastName = (session.user.name ?? 'User').split(' ').slice(1).join(' ') || 'User';

    await exchangeService.initiateNgnOnRamp({
      toCurrency: body.toCurrency,
      amountNgn: body.amountNgn,
      reference: merchantRef,
      customer: {
        email: session.user.email ?? `${userId}@klassiq.local`,
        firstName,
        lastName,
      },
      walletAddress: dest.address,
      network: body.network,
    });

    // Confirm immediately — generates the single-use bank account
    const details = await exchangeService.confirmNgnOnRamp(merchantRef);

    const intent = await prisma.cashDepositIntent.create({
      data: {
        userId,
        merchantRef,
        publicId: details.publicId,
        toCurrency: body.toCurrency.toLowerCase(),
        network: body.network,
        destAddress: dest.address,
        amountNgn: body.amountNgn,
        amountExpected: details.amountExpected,
        acctNumber: details.accountNumber,
        acctBankName: details.bankName,
        acctName: details.accountName,
        processorFee: details.processorFee ?? null,
        status: 'awaiting_payment',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CASH_DEPOSIT_INITIATED',
        entity: 'CashDepositIntent',
        entityId: intent.id,
        after: { merchantRef, toCurrency: body.toCurrency, amountNgn: body.amountNgn },
      },
    });

    return NextResponse.json({
      id: intent.id,
      merchantReference: merchantRef,
      accountNumber: details.accountNumber,
      bankName: details.bankName,
      accountName: details.accountName,
      amountExpected: details.amountExpected,
      processorFee: details.processorFee,
      vat: details.vat,
      toCurrency: body.toCurrency,
      network: body.network,
    });
  } catch (error) {
    console.error('[api/ramp/deposit POST]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid deposit request' }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Cash deposit failed';
    // Surface provider minimums / enablement errors verbatim
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** GET — list user's recent intents (for "Pending deposits" UI) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const intents = await prisma.cashDepositIntent.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return NextResponse.json({ intents });
  } catch (error) {
    console.error('[api/ramp/deposit GET]', error);
    return NextResponse.json({ error: 'Failed to load deposits' }, { status: 500 });
  }
}
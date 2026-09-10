import { auth } from '@/lib/auth';
import { verifyTransaction } from '@/lib/paystack';
import { prisma } from '@klassiq-transakt/db';
import { exchangeService } from '@klassiq-transakt/exchange';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('ref');
  if (!reference) return NextResponse.json({ error: 'ref required' }, { status: 400 });

  try {
    const result = await verifyTransaction(reference);
    if (!result) {
      return NextResponse.json({ error: 'Paystack not configured or transaction not found' }, { status: 503 });
    }

    if (result.status === 'success') {
      // Find or create PaystackTransaction record
      const existing = await prisma.paystackTransaction.findUnique({ where: { reference } });
      if (!existing) {
        await prisma.paystackTransaction.create({
          data: {
            userId: session.user.id,
            reference,
            amountKobo: result.amount,
            currency: result.currency,
            status: 'success',
            channel: result.channel,
            metadata: result.metadata,
            paidAt: new Date(result.paid_at),
          },
        });

        // If this was a deposit, credit the user's wallet via exchangeService
        // The metadata should contain the destination coin/network
        const metadata = result.metadata as Record<string, any> | undefined;
        const toCurrency = metadata?.toCurrency ?? 'usdt';
        const network = metadata?.network ?? 'trc20';

        // Get user's deposit address for the target coin
        const dest = await exchangeService.getDefaultDepositAddress(toCurrency, session.user.id);
        if (dest?.address) {
          // For now, record a transaction - actual crediting would need Quidax crediting or internal ledger
          // This is a simplified version; in production you'd need to handle the crediting flow
          await prisma.transaction.create({
            data: {
              userId: session.user.id,
              type: 'DEPOSIT',
              status: 'COMPLETED',
              provider: 'PAYSTACK',
              ngnAmount: result.amount / 100,
              fees: 0,
              metadata: { reference, channel: result.channel, toCurrency, network },
              completedAt: new Date(),
            },
          });
        }
      } else if (existing.status !== 'success') {
        await prisma.paystackTransaction.update({
          where: { reference },
          data: { status: 'success', paidAt: new Date(result.paid_at) },
        });
      }

      return NextResponse.json({ status: 'success', amountNgn: result.amount / 100, currency: result.currency });
    }

    return NextResponse.json({ status: result.status });
  } catch (error) {
    console.error('[api/paystack/verify]', error);
    return NextResponse.json({ error: 'Failed to verify transaction' }, { status: 500 });
  }
}
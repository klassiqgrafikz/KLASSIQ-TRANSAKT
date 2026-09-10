import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@klassiq-transakt/db';
import { exchangeService } from '@klassiq-transakt/exchange';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function verifyPaystackSignature(body: string, signature: string): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return false;
  const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
  return hash === signature;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-paystack-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const body = await request.text();
  if (!verifyPaystackSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event: eventType, data } = event;

  try {
    switch (eventType) {
      case 'charge.success': {
        // Card/bank payment succeeded
        const reference = data.reference;
        const amountKobo = data.amount;
        const currency = data.currency;
        const channel = data.channel;
        const paidAt = data.paid_at;
        const metadata = data.metadata;
        const customerEmail = data.customer?.email;

        // Find user by email or metadata
        let userId = metadata?.userId;
        if (!userId && customerEmail) {
          const user = await prisma.user.findUnique({ where: { email: customerEmail } });
          if (user) userId = user.id;
        }

        if (userId) {
          await prisma.paystackTransaction.upsert({
            where: { reference },
            update: {
              status: 'success',
              paidAt: new Date(paidAt),
              channel,
              amountKobo,
              currency,
              metadata,
            },
            create: {
              userId,
              reference,
              amountKobo,
              currency,
              status: 'success',
              channel,
              metadata,
              paidAt: new Date(paidAt),
            },
          });

          // If this was a deposit, credit user's wallet
          const toCurrency = metadata?.toCurrency ?? 'usdt';
          const network = metadata?.network ?? 'trc20';
          const dest = await exchangeService.getDefaultDepositAddress(toCurrency, userId);
          if (dest?.address) {
            await prisma.transaction.create({
              data: {
                userId,
                type: 'DEPOSIT',
                status: 'COMPLETED',
                provider: 'PAYSTACK',
                ngnAmount: amountKobo / 100,
                fees: 0,
                metadata: { reference, channel, toCurrency, network },
                completedAt: new Date(),
              },
            });
          }
        }
        break;
      }

      case 'transfer.success': {
        const reference = data.reference;
        const transferCode = data.transfer_code;
        await prisma.paystackTransfer.update({
          where: { reference },
          data: { status: 'success', transferCode },
        });
        await prisma.transaction.update({
          where: { paystackTransferId: reference },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        break;
      }

      case 'transfer.failed': {
        const reference = data.reference;
        const failureReason = data.failure_reason;
        await prisma.paystackTransfer.update({
          where: { reference },
          data: { status: 'failed', failureReason },
        });
        await prisma.transaction.update({
          where: { paystackTransferId: reference },
          data: { status: 'FAILED', errorMessage: failureReason },
        });
        break;
      }

      case 'dedicated_account.assign.success': {
        // Virtual account assigned
        const reference = data.reference;
        const accountNumber = data.dedicated_account?.account_number;
        const bankName = data.dedicated_account?.bank?.name;
        const accountName = data.dedicated_account?.account_name;
        const customerEmail = data.dedicated_account?.customer?.email;

        let userId: string | undefined;
        if (customerEmail) {
          const user = await prisma.user.findUnique({ where: { email: customerEmail } });
          if (user) userId = user.id;
        }

        if (userId && accountNumber) {
          await prisma.bankAccount.upsert({
            where: { userId_accountNumber_bankCode: { userId, accountNumber, bankCode: data.dedicated_account?.bank?.slug ?? 'paystack' } },
            update: { bankName: bankName ?? '', accountName: accountName ?? '', isVerified: true, verifiedAt: new Date() },
            create: {
              userId,
              bankCode: data.dedicated_account?.bank?.slug ?? 'paystack',
              bankName: bankName ?? '',
              accountNumber,
              accountName: accountName ?? '',
              isVerified: true,
              verifiedAt: new Date(),
            },
          });
        }
        break;
      }

      default:
        console.log('[Paystack webhook] Unhandled event:', eventType);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Paystack webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
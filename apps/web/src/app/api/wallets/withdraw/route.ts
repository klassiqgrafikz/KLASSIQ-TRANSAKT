import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { prisma } from '@klassiq-transakt/db';
import { createTransferRecipient, initiateTransfer } from '@/lib/paystack';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const withdrawSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('crypto'),
    currency: z.string().min(2).max(12),
    amount: z.number().positive(),
    address: z.string().min(10),
    network: z.string().optional(),
  }),
  z.object({
    mode: z.literal('ngn'),
    amount: z.number().positive(),
    bankAccountId: z.string().min(1),
  }),
]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  try {
    const body = withdrawSchema.parse(await request.json());

    if (body.mode === 'crypto') {
      const reference = `kt-wd-${userId.slice(-6)}-${Date.now()}`;
      const withdrawal = await exchangeService.withdrawCrypto({
        currency: body.currency.toLowerCase(),
        amount: body.amount,
        address: body.address,
        network: body.network,
        reference,
      }, userId);

      const txn = await prisma.transaction.create({
        data: {
          userId,
          type: 'WITHDRAW',
          status: withdrawal.status === 'COMPLETED' ? 'COMPLETED' : 'PROCESSING',
          provider: 'QUIDAX',
          ngnAmount: null,
          fees: Number(withdrawal.fee.toFixed(8)),
          exchangeWithdrawalId: withdrawal.providerWithdrawalId,
          network: body.network ?? null,
          metadata: {
            cryptoCurrency: body.currency,
            destinationAddress: body.address,
            cryptoAmount: body.amount,
            reference,
          },
          completedAt: withdrawal.status === 'COMPLETED' ? new Date() : null,
        },
      });

      return NextResponse.json({ success: true, txnId: txn.id, withdrawal });
    }

    // ── NGN bank rail: Try Paystack first, fallback to Quidax ──────────
    const account = await prisma.bankAccount.findFirst({
      where: { id: body.bankAccountId, userId },
    });
    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const reference = `kt-ngn-${userId.slice(-6)}-${Date.now()}`;

    // Try Paystack Transfer first
    try {
      const recipient = await createTransferRecipient({
        type: 'nuban',
        name: account.accountName,
        account_number: account.accountNumber,
        bank_code: account.bankCode,
        currency: 'NGN',
      });

      if (recipient) {
        const transfer = await initiateTransfer({
          source: 'balance',
          amountKobo: Math.round(body.amount * 100),
          recipient_code: recipient.recipient_code,
          reference,
          reason: 'Withdrawal',
        });

        if (transfer) {
          // Record Paystack transfer
          await prisma.paystackTransfer.create({
            data: {
              userId,
              reference: transfer.reference,
              recipientCode: recipient.recipient_code,
              amountKobo: Math.round(body.amount * 100),
              status: transfer.status,
              transferCode: transfer.transfer_code,
            },
          });

          const txn = await prisma.transaction.create({
            data: {
              userId,
              type: 'WITHDRAW',
              status: transfer.status === 'success' ? 'COMPLETED' : 'PROCESSING',
              provider: 'PAYSTACK',
              ngnAmount: body.amount,
              fees: 0,
              bankAccountId: account.id,
              paystackTransferId: transfer.reference,
              metadata: { reference: transfer.reference, transferCode: transfer.transfer_code },
              completedAt: transfer.status === 'success' ? new Date() : null,
            },
          });

          return NextResponse.json({ success: true, txnId: txn.id, withdrawal: { status: transfer.status, reference: transfer.reference } });
        }
      }
    } catch (paystackError) {
      console.warn('[api/wallets/withdraw] Paystack transfer failed, falling back to Quidax:', paystackError);
      // Fall through to Quidax
    }

    // Fallback to Quidax
    const withdrawal = await exchangeService.withdrawNgn({
      amount: body.amount,
      bankCode: account.bankCode,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      reference,
    }, userId);

    const txn = await prisma.transaction.create({
      data: {
        userId,
        type: 'WITHDRAW',
        status: withdrawal.status === 'COMPLETED' ? 'COMPLETED' : 'PROCESSING',
        provider: 'QUIDAX',
        ngnAmount: body.amount,
        fees: Number(withdrawal.fee.toFixed(2)),
        exchangeWithdrawalId: withdrawal.providerWithdrawalId,
        bankAccountId: account.id,
        metadata: { reference },
        completedAt: withdrawal.status === 'COMPLETED' ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, txnId: txn.id, withdrawal });
  } catch (error) {
    console.error('[api/wallets/withdraw POST]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid withdrawal request', details: error.flatten() }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Withdrawal failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
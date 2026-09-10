import { auth } from '@/lib/auth';
import { createTransferRecipient, initiateTransfer, fetchTransfer } from '@/lib/paystack';
import { prisma } from '@klassiq-transakt/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const transferSchema = z.object({
  amountNgn: z.number().positive().max(50_000_000),
  bankAccountId: z.string().min(1),
  reference: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = transferSchema.parse(await request.json());

    // Get user's bank account
    const account = await prisma.bankAccount.findFirst({
      where: { id: body.bankAccountId, userId: session.user.id },
    });
    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    // Create transfer recipient if not already created for this account
    // We can store recipient_code on BankAccount model in future, for now create each time
    const recipient = await createTransferRecipient({
      type: 'nuban',
      name: account.accountName,
      account_number: account.accountNumber,
      bank_code: account.bankCode,
      currency: 'NGN',
    });

    if (!recipient) {
      return NextResponse.json({ error: 'Paystack not configured' }, { status: 503 });
    }

    const reference = body.reference ?? `kt-wd-${session.user.id.slice(-6)}-${Date.now()}`;
    const transfer = await initiateTransfer({
      source: 'balance',
      amountKobo: Math.round(body.amountNgn * 100),
      recipient_code: recipient.recipient_code,
      reference,
      reason: 'Withdrawal',
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Paystack not configured' }, { status: 503 });
    }

    // Record the transfer
    await prisma.paystackTransfer.create({
      data: {
        userId: session.user.id,
        reference: transfer.reference,
        recipientCode: recipient.recipient_code,
        amountKobo: Math.round(body.amountNgn * 100),
        status: transfer.status,
        transferCode: transfer.transfer_code,
      },
    });

    // Also record a Transaction
    await prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: 'WITHDRAW',
        status: transfer.status === 'success' ? 'COMPLETED' : 'PROCESSING',
        provider: 'PAYSTACK',
        ngnAmount: body.amountNgn,
        fees: 0,
        bankAccountId: account.id,
        paystackTransferId: transfer.reference,
        metadata: { reference: transfer.reference, transferCode: transfer.transfer_code },
        completedAt: transfer.status === 'success' ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      reference: transfer.reference,
      transferCode: transfer.transfer_code,
      status: transfer.status,
    });
  } catch (error) {
    console.error('[api/paystack/transfer]', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Transfer failed' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('ref');
  if (!reference) return NextResponse.json({ error: 'ref required' }, { status: 400 });

  try {
    const transfer = await fetchTransfer(reference);
    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found or Paystack not configured' }, { status: 404 });
    }

    // Update local record
    await prisma.paystackTransfer.update({
      where: { reference },
      data: { status: transfer.status, failureReason: transfer.failure_reason },
    }).catch(() => {});

    return NextResponse.json(transfer);
  } catch (error) {
    console.error('[api/paystack/transfer GET]', error);
    return NextResponse.json({ error: 'Failed to fetch transfer' }, { status: 500 });
  }
}
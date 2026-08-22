import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { prisma } from '@klassiq-transakt/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ depositId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { depositId } = await params;

  try {
    // Find transaction by exchange deposit ID
    const transaction = await prisma.transaction.findFirst({
      where: {
        userId: session.user.id,
        exchangeDepositId: depositId,
        type: 'DEPOSIT',
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    // Check status from exchange
    const status = await exchangeService.getDepositStatus(depositId);

    // Update transaction if status changed
    if (status.status !== transaction.status) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: status.status,
          btcAmount: status.btcAmount ?? transaction.btcAmount,
          btcTxHash: status.btcTxHash ?? transaction.btcTxHash,
          completedAt: status.status === 'COMPLETED' ? new Date() : null,
        },
      });

      // If deposit completed, trigger auto-sell
      if (status.status === 'COMPLETED' && status.btcAmount) {
        // This would trigger the sell process
        // For now, just return the status
      }
    }

    return NextResponse.json({
      status: status.status,
      btcAmount: status.btcAmount,
      btcTxHash: status.btcTxHash,
    });
  } catch (error) {
    console.error('Deposit status error:', error);
    return NextResponse.json({ error: 'Failed to check deposit status' }, { status: 500 });
  }
}
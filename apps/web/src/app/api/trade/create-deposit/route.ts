import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { prisma } from '@klassiq-transakt/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createDepositSchema = z.object({
  btcAmount: z.number().positive().max(100),
  bankAccountId: z.string().cuid(),
  network: z.enum(['BITCOIN', 'LIGHTNING']).default('LIGHTNING'),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { btcAmount, bankAccountId, network } = createDepositSchema.parse(body);

    // Verify bank account belongs to user
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId: session.user.id },
    });

    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    // Use the user's default on-chain BTC deposit address from Quidax
    const addrInfo = await exchangeService.getDefaultDepositAddress('btc');
    const deposit = {
      address: addrInfo.address,
      network: network as string,
      qrCode: undefined as string | undefined,
      depositId: addrInfo.id,
      expiresAt: undefined as Date | undefined,
    };

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: 'DEPOSIT',
        status: 'PENDING',
        provider: 'YELLOW_CARD',
        network,
        btcAmount,
        btcAddress: deposit.address,
        exchangeDepositId: deposit.depositId,
        bankAccountId,
        metadata: {
          qrCode: deposit.qrCode,
          network,
          amount: btcAmount,
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_DEPOSIT',
        entity: 'Transaction',
        entityId: transaction.id,
        after: { btcAmount, network, depositId: deposit.depositId },
      },
    });

    return NextResponse.json({
      address: deposit.address,
      network: deposit.network,
      qrCode: deposit.qrCode,
      depositId: deposit.depositId,
      transactionId: transaction.id,
      expiresAt: deposit.expiresAt?.toISOString(),
    });
  } catch (error) {
    console.error('Create deposit error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to create deposit address' }, { status: 500 });
  }
}
import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify account belongs to user
    const account = await prisma.bankAccount.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Update all accounts: set default false, then set selected to true
    await prisma.$transaction([
      prisma.bankAccount.updateMany({
        where: { userId: session.user.id },
        data: { isDefault: false },
      }),
      prisma.bankAccount.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SET_DEFAULT_BANK',
        entity: 'BankAccount',
        entityId: id,
        after: { bankName: account.bankName, isDefault: true },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Set default bank error:', error);
    return NextResponse.json({ error: 'Failed to set default' }, { status: 500 });
  }
}
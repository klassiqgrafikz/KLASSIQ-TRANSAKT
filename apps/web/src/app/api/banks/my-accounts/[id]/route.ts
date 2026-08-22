import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const account = await prisma.bankAccount.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Don't allow deleting if it's the only account
    const count = await prisma.bankAccount.count({
      where: { userId: session.user.id },
    });

    if (count === 1) {
      return NextResponse.json({ error: 'Cannot delete your only bank account' }, { status: 400 });
    }

    await prisma.bankAccount.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_BANK_ACCOUNT',
        entity: 'BankAccount',
        entityId: id,
        before: { bankName: account.bankName, accountNumber: account.accountNumber.slice(-4) },
      },
    });

    // If deleted was default, make another default
    if (account.isDefault) {
      const nextAccount = await prisma.bankAccount.findFirst({
        where: { userId: session.user.id },
      });
      if (nextAccount) {
        await prisma.bankAccount.update({
          where: { id: nextAccount.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete bank account error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
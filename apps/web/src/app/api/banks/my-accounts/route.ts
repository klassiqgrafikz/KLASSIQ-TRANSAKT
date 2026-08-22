import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createAccountSchema = z.object({
  bankCode: z.string().length(3),
  accountNumber: z.string().length(10),
  accountName: z.string().min(2),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bankCode, accountNumber, accountName } = createAccountSchema.parse(body);

    // Check if account already exists for user
    const existing = await prisma.bankAccount.findUnique({
      where: {
        userId_accountNumber_bankCode: {
          userId: session.user.id,
          accountNumber,
          bankCode,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Account already added' }, { status: 400 });
    }

    // Get bank name from code
    const banks = await prisma.bank.findUnique({ where: { code: bankCode } });
    const bankName = banks?.name || bankCode;

    // Check if this is the first account (make it default)
    const accountCount = await prisma.bankAccount.count({
      where: { userId: session.user.id },
    });

    const account = await prisma.bankAccount.create({
      data: {
        userId: session.user.id,
        bankCode,
        bankName,
        accountNumber,
        accountName,
        isDefault: accountCount === 0,
        isVerified: true, // Would be false until NIBSS verification
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'ADD_BANK_ACCOUNT',
        entity: 'BankAccount',
        entityId: account.id,
        after: { bankName, accountNumber: accountNumber.slice(-4), isDefault: account.isDefault },
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error('Create bank account error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to add bank account' }, { status: 500 });
  }
}
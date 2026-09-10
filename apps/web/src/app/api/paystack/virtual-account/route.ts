import { auth } from '@/lib/auth';
import { createVirtualAccount, listVirtualAccounts } from '@/lib/paystack';
import { prisma } from '@klassiq-transakt/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Check if user already has a virtual account
    const existing = await prisma.bankAccount.findFirst({
      where: { userId: session.user.id, isVerified: true },
    });

    if (existing?.accountNumber && existing.bankCode) {
      return NextResponse.json({
        accountNumber: existing.accountNumber,
        bankName: existing.bankName,
        accountName: existing.accountName,
        bankCode: existing.bankCode,
      });
    }

    const result = await createVirtualAccount({
      email: session.user.email ?? `${session.user.id}@klassiq.local`,
      first_name: session.user.name?.split(' ')[0] ?? 'User',
      last_name: session.user.name?.split(' ').slice(1).join(' ') ?? 'User',
      country: 'NG',
    });

    if (!result) {
      return NextResponse.json({ error: 'Paystack not configured' }, { status: 503 });
    }

    // Save to BankAccount for future use
    await prisma.bankAccount.upsert({
      where: { userId_accountNumber_bankCode: { userId: session.user.id, accountNumber: result.account_number, bankCode: result.bank.slug } },
      update: { bankName: result.bank.name, accountName: result.account_name, isVerified: true, verifiedAt: new Date() },
      create: {
        userId: session.user.id,
        bankCode: result.bank.slug,
        bankName: result.bank.name,
        accountNumber: result.account_number,
        accountName: result.account_name,
        isVerified: true,
        verifiedAt: new Date(),
        isDefault: true,
      },
    });

    return NextResponse.json({
      accountNumber: result.account_number,
      bankName: result.bank.name,
      accountName: result.account_name,
      bankCode: result.bank.slug,
    });
  } catch (error) {
    console.error('[api/paystack/virtual-account]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create virtual account' }, { status: 400 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const accounts = await listVirtualAccounts(session.user.email ?? `${session.user.id}@klassiq.local`);
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('[api/paystack/virtual-account GET]', error);
    return NextResponse.json({ error: 'Failed to list virtual accounts' }, { status: 500 });
  }
}
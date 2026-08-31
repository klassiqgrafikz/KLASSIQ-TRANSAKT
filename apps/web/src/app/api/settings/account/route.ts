import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { exchangeService } from '@klassiq-transakt/exchange';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const deleteSchema = z.object({
  confirmText: z.string(),
  password: z.string().optional(),
});

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  try {
    const body = await request.json().catch(() => ({}));
    const { confirmText, password } = deleteSchema.parse(body);

    if (confirmText !== 'DELETE') {
      return NextResponse.json({ error: 'Please type DELETE to confirm' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, passwordHash: true },
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Optional password re-entry if provided — verify when present
    if (password && user.passwordHash) {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return NextResponse.json({ error: 'Password is incorrect' }, { status: 400 });
    }

    // Block if any wallet has funds (prevent accidental loss) — like quidax.com
    try {
      const wallets = await exchangeService.getWallets(userId);
      const hasFunds = wallets.some((w) => w.balance > 0.00000001 || w.locked > 0.00000001);
      if (hasFunds) {
        const funded = wallets
          .filter((w) => w.balance > 0 || w.locked > 0)
          .map((w) => `${w.currency.toUpperCase()}: ${w.balance}`)
          .join(', ');
        return NextResponse.json(
          { error: `Please withdraw all funds before deleting your account. Remaining: ${funded || 'non-zero balance'}` },
          { status: 400 }
        );
      }
    } catch (e) {
      // If wallet fetch fails due to provisioning error, don't block delete on transient exchange error
      console.warn(`[DELETE /api/settings/account] wallet check failed for ${userId}, allowing delete:`, e);
    }

    // Also block if there are pending/processing transactions that might still credit
    const pendingTx = await prisma.transaction.count({
      where: { userId, status: { in: ['PENDING', 'PROCESSING'] } },
    });
    if (pendingTx > 0) {
      return NextResponse.json(
        { error: 'You have pending transactions. Please wait for them to complete before deleting your account.' },
        { status: 400 }
      );
    }

    // Hard delete — cascade through all user-owned data
    // Order matters due to FK constraints: delete children before parent
    await prisma.$transaction(async (tx) => {
      // Child tables with FK to User
      await tx.cashDepositIntent.deleteMany({ where: { userId } });
      await tx.rateAlert.deleteMany({ where: { userId } });
      await tx.apiKey.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      // Transactions -> BankAccount FK, so delete transactions before bank accounts
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.bankAccount.deleteMany({ where: { userId } });
      await tx.paymentLink.deleteMany({ where: { userId } });

      // Invites — both created and received
      // Delete invites where this user is the creator (orphans legacy invites for others would be lost,
      // but hard delete was requested; keep pending invites for other emails by only deleting this user's own invite rows)
      await tx.invite.deleteMany({ where: { usedBy: userId } });
      await tx.invite.deleteMany({ where: { createdBy: userId } });

      // Audit logs — keep for compliance by nulling via SetNull is default, but hard delete requested => purge
      await tx.auditLog.deleteMany({ where: { userId } });

      // Finally delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ success: true, message: 'Account deleted permanently' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    console.error('[DELETE /api/settings/account]', error);
    const msg = error instanceof Error ? error.message.slice(0, 200) : 'Failed to delete account';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@klassiq-transakt/db';
import { exchangeService } from '@klassiq-transakt/exchange';

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email: rawEmail, password } = schema.parse(body);
    const email = rawEmail.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account already exists for this email. Please sign in.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: name.trim(),
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
        inviteCode: `KT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      },
    });

    // Best-effort Quidax sub-account provisioning — isolated wallets like quidax.com
    // Don't block signup if Quidax is temporarily down; lazy provisioning will retry on next wallet fetch
    try {
      const [firstName, ...rest] = name.trim().split(/\s+/);
      const lastName = rest.join(' ') || 'User';
      const subId = await exchangeService.provisionSubAccountForUser(user.id);
      // provision helper already saved quidaxSubAccountId, but ensure we capture it
      if (subId) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'QUIDAX_SUBACCOUNT_CREATED',
            entity: 'User',
            entityId: user.id,
            after: { email, subAccountId: subId },
          },
        });
      }
    } catch (provisionError) {
      console.warn(`[register] Quidax sub-account provisioning failed for ${email}:`, provisionError);
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'QUIDAX_PROVISION_PENDING',
          entity: 'User',
          entityId: user.id,
          after: { email, error: provisionError instanceof Error ? provisionError.message : String(provisionError) },
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'SELF_REGISTER',
        entity: 'User',
        entityId: user.id,
        after: { email, name: name.trim() },
      },
    });

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Please check your name, email and password (min 8 characters).' }, { status: 400 });
    }
    console.error('[register]', error);
    return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }
}

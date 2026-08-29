import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@klassiq-transakt/db';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email: rawEmail, name } = schema.parse(body);
    const email = rawEmail.toLowerCase().trim();

    // Already has an account?
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'An account already exists for this email. Please sign in.' }, { status: 400 });
    }

    // Already has an active invite?
    const existingInvite = await prisma.invite.findFirst({
      where: { email, usedBy: null, expiresAt: { gt: new Date() } },
    });
    if (existingInvite) {
      return NextResponse.json({ error: 'An invite is already pending for this email. Please check your email or contact support.' }, { status: 400 });
    }

    // Find an admin to attribute the invite to (invite-only requires a creator)
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) {
      return NextResponse.json({ error: 'Service temporarily unavailable. Please try again later.' }, { status: 503 });
    }

    const code = `KT-${randomBytes(6).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.invite.create({
      data: {
        code,
        email,
        role: 'USER',
        expiresAt,
        createdBy: admin.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'REQUEST_INVITE',
        entity: 'Invite',
        entityId: invite.id,
        after: { email: invite.email, requestedName: name ?? null, code: invite.code },
      },
    });

    const inviteUrl = `${process.env.NEXTAUTH_URL ?? ''}/auth/accept-invite/${invite.code}`;

    return NextResponse.json({
      success: true,
      message: 'Invite created successfully.',
      inviteUrl,
      code: invite.code,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    console.error('[request-invite]', error);
    return NextResponse.json({ error: 'Failed to create invite. Please try again.' }, { status: 500 });
  }
}

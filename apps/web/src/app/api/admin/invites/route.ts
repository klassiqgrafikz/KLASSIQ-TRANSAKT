import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['USER', 'ADMIN', 'MERCHANT']).default('USER'),
  expiresInDays: z.number().int().min(1).max(90).default(7),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const invites = await prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { name: true, email: true } },
        recipient: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json(invites);
  } catch (error) {
    console.error('Fetch invites error:', error);
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createInviteSchema.parse(body);

    // Check for existing unused invite for this email
    const existingInvite = await prisma.invite.findFirst({
      where: { email: data.email, usedBy: null, expiresAt: { gt: new Date() } },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An active invite already exists for this email' },
        { status: 400 }
      );
    }

    // Generate unique invite code
    const code = `KT-${randomBytes(6).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000);

    const invite = await prisma.invite.create({
      data: {
        code,
        email: data.email.toLowerCase(),
        role: data.role,
        expiresAt,
        createdBy: session.user.id,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_INVITE',
        entity: 'Invite',
        entityId: invite.id,
        after: { email: invite.email, role: invite.role, expiresAt: invite.expiresAt },
      },
    });

    return NextResponse.json({
      id: invite.id,
      code: invite.code,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviteUrl: `${process.env.NEXTAUTH_URL}/auth/accept-invite/${invite.code}`,
    });
  } catch (error) {
    console.error('Create invite error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid invite data' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@klassiq-transakt/db';
import { exchangeService } from '@klassiq-transakt/exchange';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password, name } = body;

    if (!token || !password || !name) {
      return NextResponse.json(
        { error: 'Token, password, and name are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Find and validate invite
    const invite = await prisma.invite.findUnique({
      where: { code: token },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    if (invite.usedBy) {
      return NextResponse.json({ error: 'Invite already used' }, { status: 400 });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Account already exists for this email' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user and mark invite as used in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invite.email,
          name: name.trim(),
          passwordHash,
          role: invite.role as any,
          status: 'ACTIVE',
          inviteCode: `KT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          invitedBy: invite.createdBy,
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: {
          usedBy: newUser.id,
          usedAt: new Date(),
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: newUser.id,
          action: 'ACCEPT_INVITE',
          entity: 'User',
          entityId: newUser.id,
          after: { email: newUser.email, role: newUser.role },
        },
      });

      return newUser;
    });

    // Best-effort Quidax sub-account isolation — like quidax.com personal wallets
    try {
      await exchangeService.provisionSubAccountForUser(user.id);
      await prisma.auditLog.create({
        data: { userId: user.id, action: 'QUIDAX_SUBACCOUNT_CREATED', entity: 'User', entityId: user.id, after: { email: user.email } },
      });
    } catch (provisionError) {
      console.warn(`[accept-invite] Sub-account provision failed for ${user.email}:`, provisionError);
      await prisma.auditLog.create({
        data: { userId: user.id, action: 'QUIDAX_PROVISION_PENDING', entity: 'User', entityId: user.id, after: { email: user.email, error: provisionError instanceof Error ? provisionError.message : String(provisionError) } },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json(
      { error: 'Failed to accept invite' },
      { status: 500 }
    );
  }
}
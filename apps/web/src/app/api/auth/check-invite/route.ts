import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@klassiq-transakt/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  let invite;
  try {
    invite = await prisma.invite.findUnique({
      where: { code: token },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });
  } catch (error) {
    console.error('Database error checking invite:', error);
    return NextResponse.json(
      { error: 'Service temporarily unavailable. Please try again later.' },
      { status: 503 }
    );
  }

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  if (invite.usedBy) {
    return NextResponse.json({ error: 'Invite already used' }, { status: 400 });
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
  }

  // Check if user already exists with this email
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  if (existingUser) {
    return NextResponse.json({ error: 'Account already exists for this email' }, { status: 400 });
  }

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    valid: true,
    invitedBy: invite.creator?.name,
  });
}
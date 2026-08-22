import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const invite = await prisma.invite.findUnique({ where: { id } });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (invite.usedBy) {
      return NextResponse.json({ error: 'Cannot revoke a used invite' }, { status: 400 });
    }

    await prisma.invite.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REVOKE_INVITE',
        entity: 'Invite',
        entityId: id,
        before: { email: invite.email, code: invite.code },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revoke invite error:', error);
    return NextResponse.json({ error: 'Failed to revoke invite' }, { status: 500 });
  }
}
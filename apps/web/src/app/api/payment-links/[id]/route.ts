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
    const link = await prisma.paymentLink.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!link) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    }

    await prisma.paymentLink.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_PAYMENT_LINK',
        entity: 'PaymentLink',
        entityId: id,
        before: { title: link.title, slug: link.slug },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete payment link error:', error);
    return NextResponse.json({ error: 'Failed to delete payment link' }, { status: 500 });
  }
}
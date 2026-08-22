import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { NextResponse } from 'next/server';

export async function POST(
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

    await prisma.paymentLink.update({
      where: { id },
      data: { status: 'DISABLED' },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DISABLE_PAYMENT_LINK',
        entity: 'PaymentLink',
        entityId: id,
        before: { status: link.status },
        after: { status: 'DISABLED' },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Disable payment link error:', error);
    return NextResponse.json({ error: 'Failed to disable payment link' }, { status: 500 });
  }
}
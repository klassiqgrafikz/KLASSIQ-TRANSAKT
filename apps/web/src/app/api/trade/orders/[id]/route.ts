import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** DELETE — cancel an open limit order */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    await exchangeService.cancelOrder(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[api/trade/orders/${id} DELETE]`, error);
    const message = error instanceof Error ? error.message : 'Cancel failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
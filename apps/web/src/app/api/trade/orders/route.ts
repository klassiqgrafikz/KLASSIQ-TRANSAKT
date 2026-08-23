import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { prisma } from '@klassiq-transakt/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const placeSchema = z.object({
  market: z.string().regex(/^[a-z0-9]{4,12}$/i),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['limit', 'market']),
  volume: z.number().positive(),
  price: z.number().positive().optional(),
}).refine(d => d.type === 'market' || (d.price !== undefined && d.price > 0), {
  message: 'Limit orders require a positive price',
  path: ['price'],
});

/** GET — user's orders for a market, split into open + history */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const market = request.nextUrl.searchParams.get('market');
  try {
    const all = await exchangeService.getUserOrders(market ?? undefined);
    const open = all.filter(o => o.open);
    const history = all.filter(o => !o.open).slice(0, 50);
    return NextResponse.json({ open, history });
  } catch (error) {
    console.error('[api/trade/orders GET]', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 502 });
  }
}

/** POST — place limit/market order */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const input = placeSchema.parse(body);

    const order = await exchangeService.placeOrder(input);

    // Audit trail
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PLACE_ORDER',
        entity: 'ExchangeOrder',
        entityId: String(order.providerOrderId ?? order.id),
        after: { ...input, providerOrderId: order.providerOrderId },
      },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error('[api/trade/orders POST]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid order', details: error.flatten() }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Order failed';
    // Surface provider rejection reasons (insufficient balance etc.) to the trader
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
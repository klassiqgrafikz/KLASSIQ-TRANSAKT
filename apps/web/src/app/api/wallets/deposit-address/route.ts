import { auth } from '@/lib/auth';
import { exchangeService } from '@klassiq-transakt/exchange';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET  ?currency=btc        → default deposit address
 * POST { currency, network? } → generate a NEW address (async on provider side)
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const currency = request.nextUrl.searchParams.get('currency')?.toLowerCase();
  if (!currency) return NextResponse.json({ error: 'currency required' }, { status: 400 });

  try {
    // Try default first; fall back to listing (some coins have no default until generated)
    try {
      const address = await exchangeService.getDefaultDepositAddress(currency, session.user.id);
      return NextResponse.json({ address });
    } catch {
      const list = await exchangeService.getDepositAddresses(currency, session.user.id);
      return NextResponse.json({
        address: list[0] ?? null,
        all: list,
        note: list.length === 0 ? 'No address yet — generate one.' : undefined,
      });
    }
  } catch (error) {
    console.error(`[api/wallets/deposit-address GET] ${currency}:`, error);
    return NextResponse.json({ error: 'Failed to fetch deposit address' }, { status: 502 });
  }
}

const createSchema = z.object({
  currency: z.string().min(2).max(12),
  network: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = createSchema.parse(await request.json());
    const address = await exchangeService.createDepositAddress(body.currency.toLowerCase(), body.network, session.user.id);

    // Generation may be async — surface that to the UI
    return NextResponse.json({
      address,
      pending: !address.address,
      message: address.address
        ? undefined
        : 'Address is being generated — check again in a few seconds.',
    });
  } catch (error) {
    console.error('[api/wallets/deposit-address POST]', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { exchangeService } from '@klassiq-transakt/exchange';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createLinkSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  btcAmount: z.number().positive().max(100).optional(),
  ngnAmount: z.number().positive().max(100000000).optional(),
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive().max(10000).optional(),
  redirectUrl: z.string().url().optional(),
});

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const links = await prisma.paymentLink.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(links);
  } catch (error) {
    console.error('Fetch payment links error:', error);
    return NextResponse.json({ error: 'Failed to fetch payment links' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createLinkSchema.parse(body);

    // Generate unique slug
    let slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 50);
    
    // Ensure uniqueness
    let uniqueSlug = slug;
    let counter = 1;
    while (await prisma.paymentLink.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    // Calculate NGN amount if only BTC provided
    let ngnAmount = data.ngnAmount;
    if (!ngnAmount && data.btcAmount) {
      const quote = await exchangeService.getRate('BTC', 'NGN');
      ngnAmount = data.btcAmount * quote.rate - quote.fee;
    }

    const link = await prisma.paymentLink.create({
      data: {
        userId: session.user.id,
        slug: uniqueSlug,
        title: data.title,
        description: data.description,
        btcAmount: data.btcAmount,
        ngnAmount,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        maxUses: data.maxUses,
        redirectUrl: data.redirectUrl,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_PAYMENT_LINK',
        entity: 'PaymentLink',
        entityId: link.id,
        after: { title: link.title, slug: link.slug, btcAmount: link.btcAmount, ngnAmount: link.ngnAmount },
      },
    });

    return NextResponse.json(link);
  } catch (error) {
    console.error('Create payment link error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 });
  }
}
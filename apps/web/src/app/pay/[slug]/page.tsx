import { prisma } from '@klassiq-transakt/db';
import { exchangeService } from '@klassiq-transakt/exchange';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { formatNgn, formatBtc } from '@klassiq-transakt/ui/lib/utils';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@klassiq-transakt/ui/components/Card';
import { QrCode, Bitcoin, DollarSign, Clock, Copy, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';

interface PaymentLinkData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  btcAmount: number | null;
  ngnAmount: number | null;
  status: string;
  expiresAt: string | null;
  maxUses: number | null;
  currentUses: number;
  redirectUrl: string | null;
  createdAt: string;
}

async function getPaymentLink(slug: string): Promise<PaymentLinkData | null> {
  let link;
  try {
    link = await prisma.paymentLink.findUnique({
      where: { slug },
    });
  } catch (error) {
    console.error('Database error fetching payment link:', error);
    throw new Error('DATABASE_UNAVAILABLE');
  }

  if (!link) return null;

  return {
    id: link.id,
    slug: link.slug,
    title: link.title,
    description: link.description,
    btcAmount: link.btcAmount ? Number(link.btcAmount) : null,
    ngnAmount: link.ngnAmount ? Number(link.ngnAmount) : null,
    status: link.status,
    expiresAt: link.expiresAt?.toISOString() || null,
    maxUses: link.maxUses,
    currentUses: link.currentUses,
    redirectUrl: link.redirectUrl,
    createdAt: link.createdAt.toISOString(),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  let link: PaymentLinkData | null = null;
  try {
    link = await getPaymentLink(slug);
  } catch {
    return { title: 'KLASSIQ TRANSAKT' };
  }

  if (!link) {
    return { title: 'Payment Link Not Found' };
  }

  return {
    title: `${link.title} | KLASSIQ TRANSAKT`,
    description: link.description || `Pay ${link.title} via Bitcoin`,
    openGraph: {
      title: link.title,
      description: link.description || `Pay via Bitcoin on KLASSIQ TRANSAKT`,
      type: 'website',
    },
  };
}

export default async function PaymentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let link: PaymentLinkData | null;
  try {
    link = await getPaymentLink(slug);
  } catch (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Service Unavailable</h2>
            <p className="text-muted-foreground mb-6">We're experiencing technical difficulties. Please try again shortly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!link) {
    notFound();
  }

  // Check if link is valid
  if (link.status !== 'ACTIVE') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Link Unavailable</h2>
            <p className="text-muted-foreground mb-6">
              {link.status === 'EXPIRED' ? 'This payment link has expired.' :
               link.status === 'DISABLED' ? 'This payment link has been disabled.' :
               link.status === 'COMPLETED' ? 'This payment link has been completed.' :
               'This payment link is not available.'}
            </p>
            <a href="/" className="text-primary hover:underline">Return to homepage</a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (link.maxUses && link.currentUses >= link.maxUses) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Limit Reached</h2>
            <p className="text-muted-foreground mb-6">This payment link has reached its maximum number of uses.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Link Expired</h2>
            <p className="text-muted-foreground mb-6">This payment link has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get current BTC/NGN rate for display
  let currentRate = 0;
  let currentFee = 0;
  try {
    const quote = await exchangeService.getRate('BTC', 'NGN');
    currentRate = quote.rate;
    currentFee = quote.fee;
  } catch (err) {
    console.error('Failed to fetch rate:', err);
  }

  const btcAmount = link.btcAmount || (link.ngnAmount && currentRate ? link.ngnAmount / currentRate : null);
  const ngnAmount = link.ngnAmount || (btcAmount && currentRate ? btcAmount * currentRate - currentFee : null);

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-primary mb-4">
            <Bitcoin className="h-8 w-8" />
            <span>KLASSIQ TRANSAKT</span>
          </Link>
        </div>

        {/* Payment Card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{link.title}</CardTitle>
            {link.description && <CardDescription className="text-lg">{link.description}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Amount Display */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-6 rounded-xl bg-orange-50 border border-orange-200 text-center">
                <p className="text-sm text-muted-foreground mb-1">You Pay (BTC)</p>
                <p className="text-3xl font-bold font-mono text-orange-600">
                  {btcAmount ? formatBtc(btcAmount) : 'Any amount'}
                </p>
              </div>
              <div className="p-6 rounded-xl bg-green-50 border border-green-200 text-center">
                <p className="text-sm text-muted-foreground mb-1">Recipient Gets (NGN)</p>
                <p className="text-3xl font-bold font-mono text-green-700">
                  {ngnAmount ? formatNgn(ngnAmount) : 'Calculated at payment'}
                </p>
              </div>
            </div>

            {/* Rate Info */}
            {currentRate > 0 && (
              <div className="p-4 rounded-lg bg-muted/50 border text-center">
                <p className="text-sm text-muted-foreground">Current Rate</p>
                <p className="text-xl font-bold font-mono">{formatNgn(currentRate)}/BTC</p>
                <p className="text-xs text-muted-foreground mt-1">Fee: {formatNgn(currentFee)} • Rate updates every minute</p>
              </div>
            )}

            {/* Deposit Instructions */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Bitcoin className="h-5 w-5" />
                Send Bitcoin to Complete Payment
              </h3>

              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground mb-2">Bitcoin Address (On-Chain)</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-sm font-mono break-all bg-background px-3 py-2 rounded border">
                    bc1qexampleaddressforpaymentlinkdemo...
                  </code>
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText('bc1qexampleaddressforpaymentlinkdemo...')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground mb-2">Lightning Invoice</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-sm font-mono break-all bg-background px-3 py-2 rounded border">
                    lnbcexamplelightninginvoiceforpaymentlinkdemo...
                  </code>
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText('lnbcexamplelightninginvoiceforpaymentlinkdemo...')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm font-medium flex items-center gap-2 text-blue-800">
                  <Clock className="h-4 w-4" />
                  <span>On-chain: 1 confirmation required • Lightning: Instant</span>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Send exactly {btcAmount ? formatBtc(btcAmount) : 'your desired amount'}. 
                  Under/over payments may require manual review.
                </p>
              </div>
            </div>

            {/* QR Codes Placeholder */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="text-center p-4 rounded-lg border bg-white">
                <p className="text-sm text-muted-foreground mb-2">On-Chain QR</p>
                <div className="h-48 flex items-center justify-center bg-muted/50 rounded border-2 border-dashed">
                  <span className="text-muted-foreground">QR Code Here</span>
                </div>
              </div>
              <div className="text-center p-4 rounded-lg border bg-white">
                <p className="text-sm text-muted-foreground mb-2">Lightning QR</p>
                <div className="h-48 flex items-center justify-center bg-muted/50 rounded border-2 border-dashed">
                  <span className="text-muted-foreground">QR Code Here</span>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full" size="lg" onClick={() => window.open(`bitcoin:${btcAmount ? '?amount=' + (btcAmount * 1e8).toFixed(0) : ''}`, '_blank')}>
              <Bitcoin className="h-5 w-5 mr-2" />
              Open in Wallet
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              By paying, you agree to our <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy Policy</a>
            </p>
          </CardFooter>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Powered by <span className="font-bold text-primary">KLASSIQ TRANSAKT</span></p>
          <p className="mt-1">Fast, secure Bitcoin to Naira conversions</p>
        </div>
      </div>
    </div>
  );
}
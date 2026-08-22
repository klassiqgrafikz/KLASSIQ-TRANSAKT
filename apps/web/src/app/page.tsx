'use client';

import Link from 'next/link';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@klassiq-transakt/ui/components/Card';
import { ArrowRight, Bitcoin, Shield, Zap, Users, Lock } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-20 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Now in Private Beta — Invite Only
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
              Bitcoin to Naira,{' '}
              <span className="text-primary">Instantly</span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground max-w-2xl mx-auto">
              KLASSIQ TRANSAKT is the fastest way to convert Bitcoin to Nigerian Naira.
              Lightning Network support, competitive rates, and direct bank deposits — all in one platform.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/login">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  <Bitcoin className="h-5 w-5" />
                  Get Early Access
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-28 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for <span className="text-primary">Nigerian Users</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every feature designed around how you actually move money in Nigeria
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Lightning Fast"
              description="Lightning Network deposits confirm in seconds. On-chain deposits tracked in real-time."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Your Keys, Your Coins"
              description="Non-custodial deposits. You send BTC to your unique address — we never hold your private keys."
            />
            <FeatureCard
              icon={<Bitcoin className="h-6 w-6" />}
              title="Best BTC/NGN Rates"
              description="Aggregated rates from multiple liquidity providers. Transparent fees, no hidden spreads."
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Any Nigerian Bank"
              description="Withdraw to any bank account — GTB, Access, UBA, Zenith, and 20+ others. NIBSS verified."
            />
            <FeatureCard
              icon={<Lock className="h-6 w-6" />}
              title="Invite-Only Security"
              description="Private beta with admin-controlled access. KYC-ready for future regulatory compliance."
            />
            <FeatureCard
              icon={<ArrowRight className="h-6 w-6" />}
              title="Payment Links"
              description="Create shareable payment pages. Send a link, receive BTC, auto-convert to NGN in your bank."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How It <span className="text-primary">Works</span>
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              number="01"
              title="Receive Bitcoin"
              description="Get your unique BTC address or Lightning invoice. Share with anyone worldwide."
            />
            <StepCard
              number="02"
              title="Auto or Manual Convert"
              description="Set auto-sell rules or manually trigger conversion at your target rate."
            />
            <StepCard
              number="03"
              title="NGN in Your Bank"
              description="Withdraw to your verified Nigerian bank account. Usually arrives in minutes."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-8 lg:p-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Ready to Convert BTC to NGN?
              </h2>
              <p className="text-primary/80 text-lg mb-8 max-w-2xl mx-auto">
                Join the private beta. Get your invite code and start converting Bitcoin to Naira in minutes.
              </p>
              <Link href="/auth/login">
                <Button size="lg" variant="secondary" className="gap-2">
                  <Bitcoin className="h-5 w-5" />
                  Request Invite
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <h3 className="text-xl font-bold">KLASSIQ TRANSAKT</h3>
              <p className="mt-2 text-muted-foreground max-w-xs">
                The simplest way to convert Bitcoin to Nigerian Naira. Fast, secure, and built for Nigeria.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/dashboard/trade" className="hover:text-foreground">Convert BTC → NGN</Link></li>
                <li><Link href="/dashboard/payment-links" className="hover:text-foreground">Payment Links</Link></li>
                <li><Link href="/dashboard/api-keys" className="hover:text-foreground">Developer API</Link></li>
                <li><Link href="/dashboard/rate-alerts" className="hover:text-foreground">Rate Alerts</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground">About Us</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/compliance" className="hover:text-foreground">Compliance</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} KLASSIQ TRANSAKT. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="h-full transition-shadow hover:shadow-lg">
      <CardHeader>
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold mb-4">
          {number}
        </div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
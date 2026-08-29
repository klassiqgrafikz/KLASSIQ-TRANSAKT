'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@klassiq-transakt/ui/components/Card';
import { Alert, AlertDescription } from '@klassiq-transakt/ui/components/Alert';
import { Bitcoin, Mail, User, CheckCircle, Copy, ExternalLink } from 'lucide-react';

export default function RequestInvitePage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ inviteUrl: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to request invite');
        return;
      }
      setSuccess({ inviteUrl: data.inviteUrl, code: data.code });
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!success) return;
    await navigator.clipboard.writeText(success.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mx-auto mb-4">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold mb-2">Invite Ready!</h2>
              <p className="text-sm text-muted-foreground mb-6">Your invite link is ready. It expires in 7 days.</p>
              <div className="rounded-lg border bg-muted p-3 mb-4 flex items-center gap-2">
                <p className="text-xs font-mono break-all flex-1 text-left">{success.inviteUrl}</p>
                <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0">
                  <Copy className="h-4 w-4 mr-1" /> {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Link href={success.inviteUrl} className="flex-1">
                  <Button className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" /> Accept Invite
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="outline">Back to Login</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-primary mb-4">
            <Bitcoin className="h-8 w-8" />
            <span>KLASSIQ TRANSAKT</span>
          </Link>
          <p className="text-muted-foreground">Request access to the platform</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Request an Invite</CardTitle>
            <CardDescription>Invite-only is now optional — you can also create your account directly.</CardDescription>
          </CardHeader>
          <div className="px-6">
            <Alert className="bg-violet-50 border-violet-200 text-violet-800">
              <AlertDescription className="text-sm text-center">
                Want instant access? <Link href="/auth/register" className="font-medium underline">Create account directly</Link> — your wallets will be isolated like on Quidax.
              </AlertDescription>
            </Alert>
          </div>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm leading-relaxed">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name (optional)</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="name" type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} className="pl-10" disabled={loading} autoComplete="name" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required disabled={loading} autoComplete="email" />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Request Invite
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Already have an invite?{' '}
              <Link href="/auth/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

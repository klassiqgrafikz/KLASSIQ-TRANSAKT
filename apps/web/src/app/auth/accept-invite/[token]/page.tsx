'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@klassiq-transakt/ui/components/Card';
import { Alert, AlertDescription } from '@klassiq-transakt/ui/components/Alert';
import { Bitcoin, Loader2, Mail, Lock, User, CheckCircle, AlertCircle } from 'lucide-react';
import { prisma } from '@klassiq-transakt/db';

interface InviteData {
  email: string;
  role: string;
  expiresAt: string;
  valid: boolean;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (token) {
      checkInvite(token);
    }
  }, [token]);

  const checkInvite = async (inviteToken: string) => {
    try {
      const response = await fetch(`/api/auth/check-invite?token=${inviteToken}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid or expired invite');
        return;
      }

      setInvite(data);
    } catch (err) {
      setError('Failed to verify invite');
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!token) {
      setError('Invalid invite token');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          name: name.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to accept invite');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
              </div>
              <p className="text-muted-foreground">Verifying your invite...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Invalid Invite</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Link href="/auth/login">
                <Button variant="outline">Back to Login</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mx-auto mb-4">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold mb-2">Account Created!</h2>
              <p className="text-muted-foreground mb-6">Redirecting to dashboard...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-primary mb-4">
            <Bitcoin className="h-8 w-8" />
            <span>KLASSIQ TRANSAKT</span>
          </Link>
          <p className="text-muted-foreground">Complete your account setup</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
              <Bitcoin className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl">You're Invited!</CardTitle>
            <CardDescription>
              {invite.email} • {invite.role} access
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (from invite)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={invite.email}
                    className="pl-10 bg-muted"
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="•••••••• (min 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" size="lg" loading={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4" /> : 'Create Account'}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <p className="text-xs text-center text-muted-foreground">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="underline">Terms of Service</Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline">Privacy Policy</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
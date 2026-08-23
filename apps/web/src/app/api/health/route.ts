import { NextResponse } from 'next/server';

/**
 * Deployment diagnostics — reports ONLY presence of critical env vars.
 * Never exposes values. Safe to hit publicly.
 */
export async function GET() {
  const has = (key: string) => {
    const v = process.env[key];
    return typeof v === 'string' && v.length > 0;
  };

  const checks = {
    DATABASE_URL: has('DATABASE_URL'),
    NEXTAUTH_SECRET: has('NEXTAUTH_SECRET'),
    NEXTAUTH_URL: has('NEXTAUTH_URL'),
    QUIDAX_API_KEY: has('QUIDAX_API_KEY'),
    QUIDAX_WEBHOOK_SECRET: has('QUIDAX_WEBHOOK_SECRET'),
    RESEND_API_KEY: has('RESEND_API_KEY'),
    NOTIFICATION_EMAIL: has('NOTIFICATION_EMAIL'),
    EMAIL_FROM: has('EMAIL_FROM'),
  };

  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  return NextResponse.json(
    {
      status: missing.length === 0 ? 'healthy' : 'misconfigured',
      provider: process.env.DEFAULT_EXCHANGE_PROVIDER || 'unset (defaults to YELLOW_CARD)',
      checks,
      ...(missing.length > 0 ? { missing, hint: 'Add these in Vercel → Settings → Environment Variables' } : {}),
    },
    { status: 200 }
  );
}
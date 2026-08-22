import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  EMAIL_SERVER_HOST: z.string().default('smtp.resend.com'),
  EMAIL_SERVER_PORT: z.coerce.number().default(587),
  EMAIL_SERVER_USER: z.string().default('resend'),
  EMAIL_SERVER_PASSWORD: z.string(),
  EMAIL_FROM: z.string().email(),

  // Yellow Card (Primary Exchange)
  YELLOWCARD_API_KEY: z.string().optional(),
  YELLOWCARD_API_SECRET: z.string().optional(),
  YELLOWCARD_WEBHOOK_SECRET: z.string().optional(),
  YELLOWCARD_BASE_URL: z.string().url().default('https://api.yellowcard.io'),

  // Quidax (Fallback Exchange)
  QUIDAX_API_KEY: z.string().optional(),
  QUIDAX_WEBHOOK_SECRET: z.string().optional(),
  QUIDAX_BASE_URL: z.string().url().default('https://openapi.quidax.io/exchange-open-api/api/v1'),

  // Resend
  RESEND_API_KEY: z.string().optional(),

  // Platform
  PLATFORM_FEE_BPS: z.coerce.number().default(50),
  MIN_TRADE_NGN: z.coerce.number().default(1000),
  MAX_TRADE_NGN_DAILY_BASIC: z.coerce.number().default(500000),
  MAX_TRADE_NGN_DAILY_FULL: z.coerce.number().default(10000000),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // Feature Flags
  ENABLE_KYC: z.coerce.boolean().default(true),
  ENABLE_PAYMENT_LINKS: z.coerce.boolean().default(true),
  ENABLE_API_KEYS: z.coerce.boolean().default(true),
  ENABLE_RATE_ALERTS: z.coerce.boolean().default(true),
  MAINTENANCE_MODE: z.coerce.boolean().default(false),

  // Default Exchange Provider
  DEFAULT_EXCHANGE_PROVIDER: z.enum(['YELLOW_CARD', 'QUIDAX']).default('YELLOW_CARD'),

  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export const env = getEnv();
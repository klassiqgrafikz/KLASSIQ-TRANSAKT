import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@klassiq-transakt/db';
import { env } from '@klassiq-transakt/config';

const loginSchema = z.object({
  email: z.string().email(),
  // Owner chose a 4-digit PIN for single-user access; invited users still sign up with 8+ chars.
  password: z.string().min(4),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
    newUser: '/onboarding',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const validated = loginSchema.safeParse(credentials);
        if (!validated.success) return null;

        const { email, password } = validated.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        if (user.status !== 'ACTIVE') {
          throw new Error('Account not activated. Please check your email for invite acceptance.');
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          kycLevel: user.kycLevel,
          status: user.status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id ?? token.sub ?? '';
        token.role = user.role;
        token.kycLevel = user.kycLevel;
        token.status = user.status;
      }
      if (trigger === 'update' && session) {
        token.role = session.role;
        token.kycLevel = session.kycLevel;
        token.status = session.status;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.kycLevel = token.kycLevel as string;
        session.user.status = token.status as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        if (dbUser?.status === 'SUSPENDED') {
          throw new Error('Account suspended. Contact support.');
        }
        if (dbUser?.status === 'PENDING') {
          throw new Error('Account pending invite acceptance.');
        }
      }
      return true;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'SIGN_IN',
          entity: 'User',
          entityId: user.id,
        },
      });
      // Lazy provision Quidax sub-account for open-registration users (like quidax.com personal wallets)
      // ADMIN keeps merchant principal; USER gets isolated sub-account on first sign-in if not yet provisioned
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { quidaxSubAccountId: true, role: true },
        });
        if (dbUser && !dbUser.quidaxSubAccountId && dbUser.role !== 'ADMIN') {
          const { exchangeService } = await import('@klassiq-transakt/exchange');
          await exchangeService.provisionSubAccountForUser(user.id);
        }
      } catch (e) {
        console.warn(`[auth events.signIn] sub-account provisioning failed for ${user.id}:`, e);
      }
    },
  },
  secret: env.NEXTAUTH_SECRET,
  trustHost: true,
});

declare module 'next-auth' {
  interface User {
    role: string;
    kycLevel: string;
    status: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      kycLevel: string;
      status: string;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: string;
    kycLevel: string;
    status: string;
  }
}
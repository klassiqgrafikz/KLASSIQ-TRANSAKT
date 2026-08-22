import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@klassiq-transakt/db';
import { env } from '@klassiq-transakt/config';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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
        token.id = user.id;
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
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'SIGN_IN',
          entity: 'User',
          entityId: user.id,
        },
      });
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
      role: string;
      kycLevel: string;
      status: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    kycLevel: string;
    status: string;
  }
}
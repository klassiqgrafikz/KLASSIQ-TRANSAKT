import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'KLASSIQ TRANSAKT | Bitcoin to Naira Platform',
  description: 'Convert Bitcoin to Nigerian Naira instantly. Secure, fast, and reliable BTC to NGN conversions.',
  keywords: ['bitcoin', 'btc', 'naira', 'ngn', 'crypto', 'exchange', 'nigeria', 'yellow card'],
  authors: [{ name: 'KLASSIQ TRANSAKT' }],
  creator: 'KLASSIQ TRANSAKT',
  publisher: 'KLASSIQ TRANSAKT',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: 'https://klassiqtransakt.com',
    siteName: 'KLASSIQ TRANSAKT',
    title: 'KLASSIQ TRANSAKT | Bitcoin to Naira Platform',
    description: 'Convert Bitcoin to Nigerian Naira instantly',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'KLASSIQ TRANSAKT',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KLASSIQ TRANSAKT',
    description: 'Convert Bitcoin to Nigerian Naira instantly',
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f0f' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
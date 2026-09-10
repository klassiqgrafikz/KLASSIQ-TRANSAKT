'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster position="top-right" toastOptions={{ className: 'bg-white dark:bg-gray-900 border' }} />
    </SessionProvider>
  );
}
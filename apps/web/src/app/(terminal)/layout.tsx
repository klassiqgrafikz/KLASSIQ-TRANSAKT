import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TerminalShell from '@/components/terminal/TerminalShell';

export default async function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/login');
  }

  return (
    <TerminalShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email,
        role: session.user.role,
      }}
    >
      {children}
    </TerminalShell>
  );
}
'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Bitcoin, LayoutGrid, CandlestickChart, Wallet, ArrowLeftRight,
  Link2, Shield, Settings, Menu, X, LogOut, ChevronDown,
} from 'lucide-react';
import { cn } from '@klassiq-transakt/ui/lib/utils';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@klassiq-transakt/ui/components/DropdownMenu';
import TickerStrip from './TickerStrip';

const nav = [
  { name: 'Markets', href: '/markets', icon: LayoutGrid },
  { name: 'Trade', href: '/trade/btcngn', icon: CandlestickChart, match: '/trade' },
  { name: 'Wallets', href: '/wallets', icon: Wallet },
  { name: 'Convert', href: '/convert', icon: ArrowLeftRight },
  { name: 'Payment Links', href: '/dashboard/payment-links', icon: Link2, external: true },
];

export default function TerminalShell({
  children,
  user,
}: {
  children: ReactNode;
  user: { name?: string | null; email: string; role: string };
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (item: (typeof nav)[number]) =>
    item.match ? pathname.startsWith(item.match) : pathname === item.href || pathname.startsWith(item.href + '/');

  const railItems = user.role === 'ADMIN'
    ? [...nav, { name: 'Admin', href: '/admin', icon: Shield }]
    : nav;

  return (
    <div className="theme-terminal min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-50 h-12 flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur px-3">
        <button
          className="md:hidden p-1.5 rounded hover:bg-accent"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link href="/markets" className="flex items-center gap-1.5 font-bold tracking-tight text-primary shrink-0">
          <Bitcoin className="h-5 w-5" />
          <span className="text-sm hidden sm:inline">KLASSIQ TRANSAKT</span>
        </Link>

        <TickerStrip />

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent">
              <span className="h-5 w-5 rounded-full bg-primary/20 text-primary grid place-items-center font-bold text-[10px]">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline max-w-[120px] truncate">{user.email}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 theme-terminal">
              <DropdownMenuLabel className="text-xs">
                <div>{user.name}</div>
                <div className="text-muted-foreground font-normal">{user.role}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Classic Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-red-400 focus:text-red-400 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Icon rail — desktop */}
      <nav className="hidden md:flex fixed left-0 top-12 bottom-0 z-40 w-[68px] flex-col items-center gap-1 border-r border-border bg-card py-3">
        {railItems.map((item) => (
          <RailLink key={item.name} item={item} active={isActive(item)} />
        ))}
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMenuOpen(false)} />
          <nav className="fixed left-0 top-12 bottom-0 z-50 w-56 border-r border-border bg-card p-3 space-y-1 md:hidden">
            {railItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                  isActive(item) ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </nav>
        </>
      )}

      {/* Content */}
      <main className="pt-12 md:pl-[68px] min-h-screen">{children}</main>
    </div>
  );
}

function RailLink({ item, active }: { item: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }; active: boolean }) {
  return (
    <Link
      href={item.href}
      title={item.name}
      className={cn(
        'group relative flex w-full flex-col items-center gap-1 rounded-lg py-2.5 text-[10px] transition-colors',
        active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <item.icon className="h-5 w-5" />
      {item.name}
    </Link>
  );
}
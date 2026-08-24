'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Bitcoin, LayoutGrid, CandlestickChart, Wallet, ArrowLeftRight,
  Link2, Shield, Settings, Menu, X, LogOut, ChevronDown, History, CreditCard,
} from 'lucide-react';
import { cn } from '@klassiq-transakt/ui/lib/utils';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@klassiq-transakt/ui/components/DropdownMenu';
import NetworkRotator from './NetworkRotator';

const nav = [
  { name: 'Markets', href: '/markets', icon: LayoutGrid },
  { name: 'Trade', href: '/trade/btcngn', icon: CandlestickChart, match: '/trade' },
  { name: 'Wallets', href: '/wallets', icon: Wallet },
  { name: 'Convert', href: '/convert', icon: ArrowLeftRight },
  { name: 'Payment Links', href: '/payment-links', icon: Link2 },
  { name: 'Transactions', href: '/transactions', icon: History },
  { name: 'Bank Accounts', href: '/accounts', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Top bar — light, 56px, two zones */}
      <header className="fixed top-0 inset-x-0 z-50 h-14 flex items-center gap-3 border-b border-zinc-200 bg-white px-3 shadow-sm">
        {/* Left: hamburger + brand + nav tabs */}
        <button
          className="lg:hidden p-1.5 rounded hover:bg-zinc-100"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link href="/markets" className="flex items-center gap-1.5 font-bold tracking-tight text-violet-600 shrink-0">
          <Bitcoin className="h-5 w-5" />
          <span className="text-sm hidden sm:inline">KLASSIQ TRANSAKT</span>
        </Link>

        {/* Desktop nav tabs — left zone */}
        <nav className="hidden lg:flex items-center gap-1 ml-4">
          {railItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                isActive(item)
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Right zone: rotating ticker + user */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <div className="hidden sm:block">
            <NetworkRotator />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50">
              <span className="h-6 w-6 rounded-full bg-violet-100 text-violet-700 grid place-items-center font-bold text-[10px]">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline max-w-[120px] truncate">{user.email}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">
                <div>{user.name}</div>
                <div className="text-zinc-500 font-normal">{user.role}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-red-600 focus:text-red-600 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} />
          <nav className="fixed left-0 top-14 bottom-0 z-50 w-64 border-r border-zinc-200 bg-white p-3 space-y-1 lg:hidden overflow-y-auto">
            {railItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                  isActive(item) ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:bg-zinc-100'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
            {/* Mobile: also show rotator inside drawer for visibility */}
            <div className="pt-4 sm:hidden">
              <NetworkRotator />
            </div>
          </nav>
        </>
      )}

      {/* Content — no left padding, max-width centered */}
      <main className="pt-14 min-h-screen">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

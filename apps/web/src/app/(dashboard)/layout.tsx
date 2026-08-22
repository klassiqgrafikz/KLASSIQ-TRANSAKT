'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { AvatarWithFallback } from '@klassiq-transakt/ui/components/Avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@klassiq-transakt/ui/components/DropdownMenu';
import { LayoutDashboard, Send, CreditCard, History, Settings, Users, Shield, LogOut, Menu, X, Bitcoin, Bell, Key, AlertTriangle } from 'lucide-react';
import { cn } from '@klassiq-transakt/ui/lib/utils';
import { formatRelativeTime } from '@klassiq-transakt/ui/lib/utils';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Convert', href: '/dashboard/trade', icon: Bitcoin },
  { name: 'Payment Links', href: '/dashboard/payment-links', icon: Send },
  { name: 'Transactions', href: '/dashboard/transactions', icon: History },
  { name: 'Bank Accounts', href: '/dashboard/accounts', icon: CreditCard },
  { name: 'API Keys', href: '/dashboard/api-keys', icon: Key },
  { name: 'Rate Alerts', href: '/dashboard/rate-alerts', icon: Bell },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const adminNavigation = [
  { name: 'Admin Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Transactions', href: '/admin/transactions', icon: History },
  { name: 'Invites', href: '/admin/invites', icon: Send },
  { name: 'Compliance', href: '/admin/compliance', icon: Shield },
];

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl text-primary">
              <Bitcoin className="h-6 w-6" />
              <span>KLASSIQ TRANSAKT</span>
            </Link>
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            {isAdmin && (
              <>
                <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin
                </DropdownMenuLabel>
                {adminNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-destructive/10 text-destructive'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* User menu */}
          <div className="p-4 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent">
                  <AvatarWithFallback
                    src={session?.user?.image}
                    name={session?.user?.name || ''}
                    fallback={session?.user?.email?.charAt(0).toUpperCase()}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{session?.user?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{session?.user?.name}</p>
                    <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                      {session?.user?.role}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="flex w-full items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex w-full items-center gap-2 text-destructive">
                        <Shield className="h-4 w-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-accent"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex-1" />

          {/* Notifications bell */}
          <button className="relative p-2 rounded-lg hover:bg-accent">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-white">
              3
            </span>
          </button>
        </header>

        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
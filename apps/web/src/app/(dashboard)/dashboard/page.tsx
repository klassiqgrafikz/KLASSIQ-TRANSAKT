import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { formatNgn, formatBtc, formatRelativeTime, getInitials } from '@klassiq-transakt/ui/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@klassiq-transakt/ui/components/Card';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from '@klassiq-transakt/ui/components/Table';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import Link from 'next/link';
import { Bitcoin, ArrowUpRight, ArrowDownRight, DollarSign, Send, ExternalLink, Loader2, Plus, TrendingUp, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

async function getDashboardData(userId: string) {
  const [
    totalBtcReceived,
    totalNgnWithdrawn,
    pendingTransactions,
    recentTransactions,
    bankAccounts,
    paymentLinks,
    rateAlerts,
  ] = await Promise.all([
    // Total BTC received
    prisma.transaction.aggregate({
      where: { userId, type: 'DEPOSIT', status: 'COMPLETED' },
      _sum: { btcAmount: true },
    }),
    // Total NGN withdrawn
    prisma.transaction.aggregate({
      where: { userId, type: 'WITHDRAW', status: 'COMPLETED' },
      _sum: { ngnAmount: true },
    }),
    // Pending transactions count
    prisma.transaction.count({
      where: { userId, status: { in: ['PENDING', 'PROCESSING'] } },
    }),
    // Recent transactions
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { bankAccount: true },
    }),
    // Bank accounts
    prisma.bankAccount.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    }),
    // Payment links
    prisma.paymentLink.findMany({
      where: { userId, status: 'ACTIVE' },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
    // Rate alerts
    prisma.rateAlert.findMany({
      where: { userId, enabled: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    totalBtcReceived: totalBtcReceived._sum.btcAmount ? Number(totalBtcReceived._sum.btcAmount) : 0,
    totalNgnWithdrawn: totalNgnWithdrawn._sum.ngnAmount ? Number(totalNgnWithdrawn._sum.ngnAmount) : 0,
    pendingTransactions,
    recentTransactions,
    bankAccounts,
    paymentLinks,
    rateAlerts,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return null;

  const data = await getDashboardData(userId);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {session.user?.name?.split(' ')[0] || 'there'}</h1>
          <p className="text-muted-foreground">Here's an overview of your BTC to NGN conversions</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/trade">
            <Button>
              <Bitcoin className="h-4 w-4 mr-2" />
              Convert BTC
            </Button>
          </Link>
          <Link href="/dashboard/payment-links/new">
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              New Payment Link
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total BTC Received"
          value={formatBtc(data.totalBtcReceived)}
          icon={<Bitcoin className="h-5 w-5 text-orange-500" />}
          trend="+12% this month"
          trendIcon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          title="Total NGN Withdrawn"
          value={formatNgn(data.totalNgnWithdrawn)}
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
          trend="+8% this month"
          trendIcon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          title="Active Payment Links"
          value={data.paymentLinks.length}
          icon={<Send className="h-5 w-5 text-blue-500" />}
          trend={data.paymentLinks.length > 0 ? 'View all' : 'Create one'}
          trendIcon={<ExternalLink className="h-4 w-4" />}
        />
        <StatCard
          title="Pending Transactions"
          value={data.pendingTransactions}
          icon={<Clock className="h-5 w-5 text-yellow-500" />}
          trend={data.pendingTransactions > 0 ? 'Processing...' : 'All clear'}
          trendIcon={data.pendingTransactions > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
          variant={data.pendingTransactions > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Quick Actions & Recent Transactions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Common tasks you might want to do</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ActionButton
                icon={<Bitcoin className="h-4 w-4" />}
                title="Convert BTC to NGN"
                description="Sell Bitcoin, get Naira in your bank"
                href="/dashboard/trade"
                primary
              />
              <ActionButton
                icon={<Send className="h-4 w-4" />}
                title="Create Payment Link"
                description="Share a link, receive BTC auto-convert"
                href="/dashboard/payment-links/new"
              />
              <ActionButton
                icon={<Plus className="h-4 w-4" />}
                title="Add Bank Account"
                description="Connect your Nigerian bank for withdrawals"
                href="/dashboard/accounts"
              />
              <ActionButton
                icon={<TrendingUp className="h-4 w-4" />}
                title="Set Rate Alert"
                description="Get notified when BTC hits your target"
                href="/dashboard/rate-alerts"
              />
            </CardContent>
          </Card>

          {/* Bank Accounts Summary */}
          {data.bankAccounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Banks</CardTitle>
                <CardDescription>{data.bankAccounts.length} account{data.bankAccounts.length !== 1 ? 's' : ''} connected</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.bankAccounts.slice(0, 3).map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{account.bankName}</p>
                        <p className="text-xs text-muted-foreground">{account.accountNumber.slice(-4)} • {account.isDefault ? 'Default' : 'Secondary'}</p>
                      </div>
                    </div>
                    {account.isVerified && <CheckCircle className="h-4 w-4 text-green-500" />}
                  </div>
                ))}
                {data.bankAccounts.length > 3 && (
                  <Link href="/dashboard/accounts" className="text-sm text-primary hover:underline block text-center py-2">
                    View all {data.bankAccounts.length} accounts →
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Rate Alerts Summary */}
          {data.rateAlerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Rate Alerts</CardTitle>
                <CardDescription>{data.rateAlerts.length} alert{data.rateAlerts.length !== 1 ? 's' : ''} monitoring</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.rateAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className={alert.direction === 'ABOVE' ? 'text-green-500' : 'text-red-500'}>
                        {alert.direction === 'ABOVE' ? '↑' : '↓'}
                      </span>
                      <span className="font-mono text-sm">{formatNgn(Number(alert.targetRate))}/BTC</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{alert.enabled ? 'Active' : 'Paused'}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
                <CardDescription>Your latest BTC deposits, conversions, and withdrawals</CardDescription>
              </div>
              <Link href="/dashboard/transactions" className="text-sm text-primary hover:underline">
                View all →
              </Link>
            </CardHeader>
            <CardContent>
              {data.recentTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <Bitcoin className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No transactions yet</h3>
                  <p className="text-muted-foreground mb-6">Start by receiving Bitcoin or creating a payment link</p>
                  <Link href="/dashboard/trade">
                    <Button>
                      <Bitcoin className="h-4 w-4 mr-2" />
                      Convert BTC Now
                    </Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentTransactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="font-mono text-sm">{txn.id.slice(0, 12)}...</TableCell>
                        <TableCell>
                          <Badge variant={getTypeBadgeVariant(txn.type)}>
                            {getTypeIcon(txn.type)}
                            {txn.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {txn.type === 'DEPOSIT' && txn.btcAmount ? formatBtc(Number(txn.btcAmount)) : ''}
                          {txn.type === 'SELL' && txn.btcAmount && txn.ngnAmount ? (
                            <>
                              {formatBtc(Number(txn.btcAmount))} → {formatNgn(Number(txn.ngnAmount))}
                            </>
                          ) : ''}
                          {txn.type === 'WITHDRAW' && txn.ngnAmount ? formatNgn(Number(txn.ngnAmount)) : ''}
                          {txn.type === 'PAYMENT_LINK' && txn.ngnAmount ? formatNgn(Number(txn.ngnAmount)) : ''}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={txn.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatRelativeTime(txn.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableCaption>
                    Showing {data.recentTransactions.length} of your most recent transactions
                  </TableCaption>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  trend,
  trendIcon,
  variant = 'default',
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend: string;
  trendIcon: React.ReactNode;
  variant?: 'default' | 'warning';
}) {
  return (
    <Card className={variant === 'warning' ? 'border-yellow-200' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          {trendIcon} {trend}
        </p>
      </CardContent>
    </Card>
  );
}

function ActionButton({
  icon,
  title,
  description,
  href,
  primary = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link href={href}>
      <Button
        variant={primary ? 'default' : 'outline'}
        className="w-full justify-start gap-3 p-3 h-auto"
      >
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <div className="text-left">
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </Button>
    </Link>
  );
}

function getTypeBadgeVariant(type: string) {
  switch (type) {
    case 'DEPOSIT': return 'success';
    case 'SELL': return 'default';
    case 'WITHDRAW': return 'info';
    case 'PAYMENT_LINK': return 'secondary';
    default: return 'outline';
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'DEPOSIT': return <ArrowDownRight className="h-3 w-3 mr-1" />;
    case 'SELL': return <ArrowUpRight className="h-3 w-3 mr-1" />;
    case 'WITHDRAW': return <Send className="h-3 w-3 mr-1" />;
    case 'PAYMENT_LINK': return <ExternalLink className="h-3 w-3 mr-1" />;
    default: return <Bitcoin className="h-3 w-3 mr-1" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'success' | 'destructive' | 'warning' | 'info' | 'outline'> = {
    COMPLETED: 'success',
    PENDING: 'warning',
    PROCESSING: 'info',
    FAILED: 'destructive',
    MANUAL_REVIEW: 'destructive',
  };

  const icons: Record<string, React.ReactNode> = {
    COMPLETED: <CheckCircle className="h-3 w-3 mr-1" />,
    PENDING: <Clock className="h-3 w-3 mr-1" />,
    PROCESSING: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
    FAILED: <XCircle className="h-3 w-3 mr-1" />,
    MANUAL_REVIEW: <AlertTriangle className="h-3 w-3 mr-1" />,
  };

  return (
    <Badge variant={variants[status] || 'outline'}>
      {icons[status]}
      {status.replace('_', ' ')}
    </Badge>
  );
}
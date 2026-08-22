import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@klassiq-transakt/ui/components/Card';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import { formatNgn, formatBtc, formatRelativeTime } from '@klassiq-transakt/ui/lib/utils';
import { Users, DollarSign, Bitcoin, Send, Shield, TrendingUp, Loader2 } from 'lucide-react';
import Link from 'next/link';

async function getAdminStats() {
  const [
    totalUsers,
    activeUsers,
    totalVolumeBtc,
    totalVolumeNgn,
    pendingTransactions,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.transaction.aggregate({
      where: { type: 'DEPOSIT', status: 'COMPLETED' },
      _sum: { btcAmount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'WITHDRAW', status: 'COMPLETED' },
      _sum: { ngnAmount: true },
    }),
    prisma.transaction.count({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
    }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, status: true, role: true, createdAt: true },
    }),
  ]);

  return {
    totalUsers,
    activeUsers,
    totalVolumeBtc: totalVolumeBtc._sum.btcAmount ? Number(totalVolumeBtc._sum.btcAmount) : 0,
    totalVolumeNgn: totalVolumeNgn._sum.ngnAmount ? Number(totalVolumeNgn._sum.ngnAmount) : 0,
    pendingTransactions,
    recentUsers,
  };
}

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const stats = await getAdminStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform overview and management</p>
        </div>
        <Link href="/admin/users">
          <Button variant="outline">
            <Users className="h-4 w-4 mr-2" />
            Manage Users
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          subtitle={`${stats.activeUsers} active`}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          trend="+12% this month"
        />
        <AdminStatCard
          title="Total BTC Volume"
          value={formatBtc(stats.totalVolumeBtc)}
          subtitle="All-time deposits"
          icon={<Bitcoin className="h-5 w-5 text-orange-500" />}
          trend="+8% this month"
        />
        <AdminStatCard
          title="Total NGN Volume"
          value={formatNgn(stats.totalVolumeNgn)}
          subtitle="All-time withdrawals"
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
          trend="+15% this month"
        />
        <AdminStatCard
          title="Pending Transactions"
          value={stats.pendingTransactions}
          subtitle="Requiring attention"
          icon={<Loader2 className="h-5 w-5 text-yellow-500" />}
          variant={stats.pendingTransactions > 0 ? 'warning' : 'success'}
          trend={stats.pendingTransactions > 0 ? 'Review needed' : 'All clear'}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <AdminActionCard
          title="Users"
          description="View and manage all users"
          icon={<Users className="h-6 w-6" />}
          href="/admin/users"
        />
        <AdminActionCard
          title="Transactions"
          description="Monitor all platform transactions"
          icon={<DollarSign className="h-6 w-6" />}
          href="/admin/transactions"
        />
        <AdminActionCard
          title="Invites"
          description="Create and manage invite codes"
          icon={<Send className="h-6 w-6" />}
          href="/admin/invites"
        />
        <AdminActionCard
          title="Compliance"
          description="KYC reviews and audit logs"
          icon={<Shield className="h-6 w-6" />}
          href="/admin/compliance"
        />
        <AdminActionCard
          title="Exchange Health"
          description="Monitor Yellow Card & Quidax status"
          icon={<TrendingUp className="h-6 w-6" />}
          href="/admin/exchange"
        />
        <AdminActionCard
          title="Settings"
          description="Platform configuration"
          icon={<Shield className="h-6 w-6" />}
          href="/admin/settings"
        />
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Users</CardTitle>
            <CardDescription>Latest registrations</CardDescription>
          </div>
          <Link href="/admin/users" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{user.name || 'Unnamed'}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={user.status === 'ACTIVE' ? 'success' : 'outline'}>
                    {user.status}
                  </Badge>
                  <Badge variant={user.role === 'ADMIN' ? 'destructive' : 'secondary'}>
                    {user.role}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{formatRelativeTime(user.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminStatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend: string;
  variant?: 'default' | 'warning' | 'success';
}) {
  return (
    <Card className={variant === 'warning' ? 'border-yellow-200' : variant === 'success' ? 'border-green-200' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        <p className="text-xs text-muted-foreground mt-1">{trend}</p>
      </CardContent>
    </Card>
  );
}

function AdminActionCard({
  title,
  description,
  icon,
  href,
}: { title: string; description: string; icon: React.ReactNode; href: string }) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardContent className="p-6">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
            {icon}
          </div>
          <h3 className="font-semibold text-lg mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@klassiq-transakt/ui/components/Card';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { formatNgn, formatBtc, formatRelativeTime } from '@klassiq-transakt/ui/lib/utils';
import { Bitcoin, Search, Download, Loader2, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';

const ITEMS_PER_PAGE = 25;

async function getAllTransactions(page = 1, filters: Record<string, string> = {}) {
  const where: any = {};

  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
      include: {
        user: { select: { id: true, email: true, name: true } },
        bankAccount: true,
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total, totalPages: Math.ceil(total / ITEMS_PER_PAGE) };
}

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; status?: string }>;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const filters = { type: params.type || '', status: params.status || '' };

  const { transactions, total, totalPages } = await getAllTransactions(page, filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All Transactions</h1>
          <p className="text-muted-foreground">{total} transactions platform-wide</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-4" method="GET">
            <div className="min-w-[180px]">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue={filters.type}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Types</option>
                <option value="DEPOSIT">Deposits</option>
                <option value="SELL">Sells</option>
                <option value="WITHDRAW">Withdrawals</option>
                <option value="PAYMENT_LINK">Payment Links</option>
              </select>
            </div>
            <div className="min-w-[180px]">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={filters.status}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="MANUAL_REVIEW">Manual Review</option>
              </select>
            </div>
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-muted">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/50">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-muted/30">
                    <td className="px-4 py-4 font-mono text-sm">{txn.id.slice(0, 10)}...</td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-sm">{txn.user.name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground">{txn.user.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={txn.type === 'DEPOSIT' ? 'success' : txn.type === 'WITHDRAW' ? 'info' : 'default'}>
                        {txn.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm">
                      {txn.btcAmount ? `${Number(txn.btcAmount).toFixed(8)} BTC` : ''}
                      {txn.ngnAmount ? ` → ${formatNgn(Number(txn.ngnAmount))}` : ''}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={txn.status} />
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {formatRelativeTime(txn.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm">
                      {txn.status === 'MANUAL_REVIEW' && (
                        <Button size="sm" variant="outline">Review</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`?page=${page - 1}`}>
                    <Button variant="outline" size="sm">Previous</Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`?page=${page + 1}`}>
                    <Button variant="outline" size="sm">Next</Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'success' | 'destructive' | 'warning' | 'info'> = {
    COMPLETED: 'success',
    PENDING: 'warning',
    PROCESSING: 'info',
    FAILED: 'destructive',
    MANUAL_REVIEW: 'destructive',
  };
  return <Badge variant={variants[status] || 'outline'}>{status.replace('_', ' ')}</Badge>;
}
import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { formatNgn, formatBtc, formatRelativeTime } from '@klassiq-transakt/ui/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@klassiq-transakt/ui/components/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from '@klassiq-transakt/ui/components/Table';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, Send, Bitcoin, DollarSign, ExternalLink, Download, Filter, ChevronDown } from 'lucide-react';
import Link from 'next/link';

const ITEMS_PER_PAGE = 20;

async function getTransactions(userId: string, page = 1, filters: any = {}) {
  const where: any = { userId };

  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
      include: { bankAccount: true, paymentLink: true },
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total, totalPages: Math.ceil(total / ITEMS_PER_PAGE) };
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; status?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return null;

  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const filters = {
    type: params.type,
    status: params.status,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  };

  const { transactions, total, totalPages } = await getTransactions(userId, page, filters);

  const typeOptions = [
    { value: 'DEPOSIT', label: 'BTC Deposits' },
    { value: 'SELL', label: 'BTC Sold' },
    { value: 'WITHDRAW', label: 'NGN Withdrawals' },
    { value: 'PAYMENT_LINK', label: 'Payment Links' },
  ];

  const statusOptions = [
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'MANUAL_REVIEW', label: 'Manual Review' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">View and manage all your BTC and NGN transactions</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-4" method="GET">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="type" className="text-sm font-medium">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue={filters.type || ''}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Types</option>
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="status" className="text-sm font-medium">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={filters.status || ''}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Statuses</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="dateFrom" className="text-sm font-medium">From</Label>
              <Input
                name="dateFrom"
                type="date"
                value={filters.dateFrom || ''}
                className="w-full"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="dateTo" className="text-sm font-medium">To</Label>
              <Input
                name="dateTo"
                type="date"
                value={filters.dateTo || ''}
                className="w-full"
              />
            </div>
            <Button type="submit" className="h-10">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>{total} transaction{total !== 1 ? 's' : ''} found</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <Bitcoin className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No transactions found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or start trading</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Rate/Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Bank / Link</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="font-mono text-sm">
                          <Link href={`/dashboard/transactions/${txn.id}`} className="hover:underline">
                            {txn.id.slice(0, 12)}...
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTypeBadgeVariant(txn.type)}>
                            {getTypeIcon(txn.type)}
                            {txn.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {renderAmount(txn)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {renderRateFee(txn)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={txn.status} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {renderBankOrLink(txn)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatRelativeTime(txn.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} • {total} total
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link
                        href={`?page=${page - 1}${buildQueryString(filters)}`}
                      >
                        <Button variant="outline" size="sm">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link
                        href={`?page=${page + 1}${buildQueryString(filters)}`}
                      >
                        <Button variant="outline" size="sm">
                          <ChevronDown className="h-4 w-4 rotate-180" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
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

function renderAmount(txn: any) {
  if (txn.type === 'DEPOSIT' && txn.btcAmount) return formatBtc(Number(txn.btcAmount));
  if (txn.type === 'SELL' && txn.btcAmount && txn.ngnAmount) {
    return `${formatBtc(Number(txn.btcAmount))} → ${formatNgn(Number(txn.ngnAmount))}`;
  }
  if (txn.type === 'WITHDRAW' && txn.ngnAmount) return formatNgn(Number(txn.ngnAmount));
  if (txn.type === 'PAYMENT_LINK' && txn.ngnAmount) return formatNgn(Number(txn.ngnAmount));
  return '—';
}

function renderRateFee(txn: any) {
  if (txn.type === 'SELL' && txn.exchangeRate) {
    return `${formatNgn(Number(txn.exchangeRate))}/BTC • Fee: ${formatNgn(Number(txn.fees || 0))}`;
  }
  if (txn.type === 'WITHDRAW' && txn.fees) {
    return `Fee: ${formatNgn(Number(txn.fees))}`;
  }
  return '—';
}

function renderBankOrLink(txn: any) {
  if (txn.bankAccount) {
    return (
      <span className="flex items-center gap-1">
        <DollarSign className="h-3 w-3" />
        {txn.bankAccount.bankName} ••••{txn.bankAccount.accountNumber.slice(-4)}
      </span>
    );
  }
  if (txn.paymentLink) {
    return (
      <span className="flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />
        {txn.paymentLink.title}
      </span>
    );
  }
  return '—';
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'success' | 'destructive' | 'warning' | 'info' | 'outline'> = {
    COMPLETED: 'success',
    PENDING: 'warning',
    PROCESSING: 'info',
    FAILED: 'destructive',
    MANUAL_REVIEW: 'destructive',
  };

  return <Badge variant={variants[status] || 'outline'}>{status.replace('_', ' ')}</Badge>;
}

function buildQueryString(filters: any) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value as string);
  });
  return params.toString() ? `&${params.toString()}` : '';
}
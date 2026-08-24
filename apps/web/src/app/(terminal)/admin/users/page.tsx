import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@klassiq-transakt/ui/components/Card';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Select, SelectOption } from '@klassiq-transakt/ui/components/Select';
import { formatRelativeTime } from '@klassiq-transakt/ui/lib/utils';
import { Plus, Search, Mail, User, Shield, Loader2, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';

async function getUsers(page = 1, search = '', status = '', role = '') {
  const where: any = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status) where.status = status;
  if (role) where.role = role;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 20,
      take: 20,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        role: true,
        kycLevel: true,
        createdAt: true,
        _count: { select: { transactions: true, accounts: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, totalPages: Math.ceil(total / 20) };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string; role?: string }>;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const search = params.search || '';
  const status = params.status || '';
  const role = params.role || '';

  const { users, total, totalPages } = await getUsers(page, search, status, role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">{total} users total</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-4" method="GET">
            <div className="flex-1 min-w-[250px]">
              <Label htmlFor="search" className="sr-only">Search</Label>
              <Input
                id="search"
                name="search"
                placeholder="Search email or name..."
                value={search}
                className="w-full"
              />
            </div>
            <div className="min-w-[150px]">
              <Select name="status" value={status}>
                <SelectOption value="">All Statuses</SelectOption>
                <SelectOption value="ACTIVE">Active</SelectOption>
                <SelectOption value="PENDING">Pending</SelectOption>
                <SelectOption value="SUSPENDED">Suspended</SelectOption>
                <SelectOption value="KYC_REQUIRED">KYC Required</SelectOption>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Select name="role" value={role}>
                <SelectOption value="">All Roles</SelectOption>
                <SelectOption value="USER">User</SelectOption>
                <SelectOption value="ADMIN">Admin</SelectOption>
                <SelectOption value="MERCHANT">Merchant</SelectOption>
              </Select>
            </div>
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-muted">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">KYC</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Activity</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Joined</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.name || 'Unnamed'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={getStatusBadgeVariant(user.status)}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={user.role === 'ADMIN' ? 'destructive' : user.role === 'MERCHANT' ? 'secondary' : 'outline'}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={getKycBadgeVariant(user.kycLevel)}>
                        {user.kycLevel}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {user._count.transactions} txns • {user._count.accounts} banks
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {formatRelativeTime(user.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/users/${user.id}`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages} • {total} total</p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`?page=${page - 1}${buildQueryString({ search, status, role })}`}>
                    <Button variant="outline" size="sm">Previous</Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`?page=${page + 1}${buildQueryString({ search, status, role })}`}>
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

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'PENDING': return 'warning';
    case 'SUSPENDED': return 'destructive';
    case 'KYC_REQUIRED': return 'default';
    default: return 'outline';
  }
}

function getKycBadgeVariant(kyc: string) {
  switch (kyc) {
    case 'FULL': return 'success';
    case 'BASIC': return 'default';
    case 'NONE': return 'outline';
    default: return 'outline';
  }
}

function buildQueryString(params: Record<string, string>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.append(key, value);
  });
  return searchParams.toString() ? `&${searchParams.toString()}` : '';
}
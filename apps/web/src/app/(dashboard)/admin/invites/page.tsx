import { auth } from '@/lib/auth';
import { prisma } from '@klassiq-transakt/db';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@klassiq-transakt/ui/components/Card';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Select, SelectOption } from '@klassiq-transakt/ui/components/Select';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@klassiq-transakt/ui/components/Dialog';
import { formatRelativeTime } from '@klassiq-transakt/ui/lib/utils';
import { Plus, Copy, XCircle } from 'lucide-react';
import Link from 'next/link';
import { InviteFormDialog, InviteActions } from './invite-form';

async function getInvites(page = 1, search = '', status = '') {
  const where: any = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status === 'USED') where.usedBy = { not: null };
  if (status === 'PENDING') where.usedBy = null;

  const [invites, total] = await Promise.all([
    prisma.invite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 20,
      take: 20,
      include: {
        creator: { select: { id: true, name: true, email: true } },
        recipient: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.invite.count({ where }),
  ]);

  return { invites, total, totalPages: Math.ceil(total / 20) };
}

export default async function AdminInvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const search = params.search || '';
  const status = params.status || '';

  const { invites, total, totalPages } = await getInvites(page, search, status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invite Management</h1>
          <p className="text-muted-foreground">{total} invites total</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Invite
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Invite</DialogTitle>
            </DialogHeader>
            <InviteFormDialog />
          </DialogContent>
        </Dialog>
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
                placeholder="Search email or code..."
                value={search}
                className="w-full"
              />
            </div>
            <div className="min-w-[150px]">
              <Select name="status" value={status}>
                <SelectOption value="">All</SelectOption>
                <SelectOption value="PENDING">Pending</SelectOption>
                <SelectOption value="USED">Used</SelectOption>
                <SelectOption value="EXPIRED">Expired</SelectOption>
              </Select>
            </div>
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      {/* Invites Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-muted">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Created By</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Expires</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/50">
                {invites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-muted/30">
                    <td className="px-4 py-4 font-mono text-sm">{invite.code}</td>
                    <td className="px-4 py-4">{invite.email}</td>
                    <td className="px-4 py-4">
                      <Badge variant={invite.role === 'ADMIN' ? 'destructive' : 'secondary'}>
                        {invite.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={getInviteStatusVariant(invite)}>
                        {getInviteStatus(invite)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {invite.creator?.name || invite.creator?.email}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {formatRelativeTime(invite.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {formatRelativeTime(invite.expiresAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {!invite.usedBy && (
                        <InviteActions code={invite.code} inviteId={invite.id} />
                      )}
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
                  <Link href={`?page=${page - 1}${buildQueryString({ search, status })}`}>
                    <Button variant="outline" size="sm">Previous</Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`?page=${page + 1}${buildQueryString({ search, status })}`}>
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

function getInviteStatus(invite: any) {
  if (invite.usedBy) return 'USED';
  if (new Date(invite.expiresAt) < new Date()) return 'EXPIRED';
  return 'PENDING';
}

function getInviteStatusVariant(invite: any) {
  const status = getInviteStatus(invite);
  switch (status) {
    case 'USED': return 'success';
    case 'EXPIRED': return 'destructive';
    case 'PENDING': return 'warning';
    default: return 'outline';
  }
}

function copyInviteLink(code: string) {
  const url = `${window.location.origin}/auth/accept-invite/${code}`;
  navigator.clipboard.writeText(url);
}

function buildQueryString(params: Record<string, string>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.append(key, value);
  });
  return searchParams.toString() ? `&${searchParams.toString()}` : '';
}
'use client';

import { useState } from 'react';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@klassiq-transakt/ui/components/Card';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@klassiq-transakt/ui/components/Dialog';
import { formatNgn, formatRelativeTime, cn } from '@klassiq-transakt/ui/lib/utils';
import { Plus, Copy, ExternalLink, Edit, Trash2, Loader2, Link as LinkIcon, DollarSign, Bitcoin, CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';
import Link from 'next/link';

interface PaymentLink {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  btcAmount: number | null;
  ngnAmount: number | null;
  status: string;
  expiresAt: string | null;
  maxUses: number | null;
  currentUses: number;
  redirectUrl: string | null;
  createdAt: string;
}

export default function PaymentLinksPage() {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    btcAmount: '',
    ngnAmount: '',
    expiresAt: '',
    maxUses: '',
    redirectUrl: '',
  });

  const fetchLinks = async () => {
    try {
      const res = await fetch('/api/payment-links');
      if (res.ok) {
        const data = await res.json();
        setLinks(data);
      }
    } catch (err) {
      console.error('Failed to fetch payment links:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.btcAmount && !formData.ngnAmount) {
      setError('Enter either BTC or NGN amount');
      return;
    }

    setIsCreating(true);

    try {
      const res = await fetch('/api/payment-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          btcAmount: formData.btcAmount ? parseFloat(formData.btcAmount) : undefined,
          ngnAmount: formData.ngnAmount ? parseFloat(formData.ngnAmount) : undefined,
          expiresAt: formData.expiresAt || undefined,
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
          redirectUrl: formData.redirectUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create payment link');
      }

      setShowCreateDialog(false);
      setFormData({
        title: '',
        description: '',
        btcAmount: '',
        ngnAmount: '',
        expiresAt: '',
        maxUses: '',
        redirectUrl: '',
      });
      await fetchLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this payment link?')) return;

    try {
      const res = await fetch(`/api/payment-links/${linkId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchLinks();
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleDisableLink = async (linkId: string) => {
    try {
      const res = await fetch(`/api/payment-links/${linkId}/disable`, {
        method: 'POST',
      });

      if (res.ok) {
        await fetchLinks();
      }
    } catch (err) {
      console.error('Failed to disable:', err);
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/pay/${slug}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payment Links</h1>
          <p className="text-muted-foreground">Create shareable links to receive Bitcoin payments</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Payment Link
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Payment Link</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateLink} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Invoice #1234, Consulting Fee"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Optional description for the payer"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="btcAmount">BTC Amount (optional)</Label>
                  <Input
                    id="btcAmount"
                    type="number"
                    step="0.00000001"
                    min="0.00001"
                    placeholder="0.001"
                    value={formData.btcAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, btcAmount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ngnAmount">NGN Amount (optional)</Label>
                  <Input
                    id="ngnAmount"
                    type="number"
                    step="100"
                    min="1000"
                    placeholder="50000"
                    value={formData.ngnAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, ngnAmount: e.target.value }))}
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Leave both empty for open amount. Enter one to fix the amount.
              </p>

              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires At (optional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxUses">Max Uses (optional)</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formData.maxUses}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxUses: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="redirectUrl">Redirect URL (optional)</Label>
                <Input
                  id="redirectUrl"
                  type="url"
                  placeholder="https://your-site.com/thank-you"
                  value={formData.redirectUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, redirectUrl: e.target.value }))}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isCreating}>
                  {isCreating ? <Loader2 className="h-4 w-4" /> : 'Create Link'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Links List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Payment Links</CardTitle>
          <CardDescription>{links.length} link{links.length !== 1 ? 's' : ''} created</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : links.length === 0 ? (
            <div className="text-center py-12">
              <LinkIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No payment links yet</h3>
              <p className="text-muted-foreground mb-6">Create your first link to start receiving payments</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Payment Link
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {links.map((link) => (
                <div
                  key={link.id}
                  className={cn(
                    'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border',
                    link.status === 'ACTIVE' ? 'border-green-200 bg-green-50/50' : 'border-muted'
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <LinkIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-medium truncate">{link.title}</h3>
                        <StatusBadge status={link.status} />
                        {link.ngnAmount && (
                          <Badge variant="success">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {formatNgn(link.ngnAmount)}
                          </Badge>
                        )}
                        {link.btcAmount && (
                          <Badge variant="default">
                            <Bitcoin className="h-3 w-3 mr-1" />
                            {link.btcAmount.toFixed(8)} BTC
                          </Badge>
                        )}
                      </div>
                      {link.description && (
                        <p className="text-sm text-muted-foreground truncate mt-1">{link.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {link.currentUses}/{link.maxUses || '∞'} uses
                        </span>
                        {link.expiresAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Expires {formatRelativeTime(link.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(link.slug)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Link
                    </Button>
                    <Link
                      href={`/pay/${link.slug}`}
                      target="_blank"
                    >
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                    </Link>
                    {link.status === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDisableLink(link.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Disable
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteLink(link.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'success' | 'destructive' | 'warning' | 'outline'> = {
    ACTIVE: 'success',
    COMPLETED: 'default',
    EXPIRED: 'destructive',
    DISABLED: 'outline',
  };
  return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
}

function formatBtc(amount: number) {
  return amount.toFixed(8);
}
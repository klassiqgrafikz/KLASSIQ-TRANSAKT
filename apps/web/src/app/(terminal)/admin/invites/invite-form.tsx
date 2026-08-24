'use client';

import { useState } from 'react';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Select, SelectOption } from '@klassiq-transakt/ui/components/Select';
import { DialogFooter } from '@klassiq-transakt/ui/components/Dialog';
import { Loader2, Copy, XCircle } from 'lucide-react';

export function InviteActions({ code, inviteId }: { code: string; inviteId: string }) {
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyInviteLink = () => {
    const url = `${window.location.origin}/auth/accept-invite/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const revokeInvite = async () => {
    if (!confirm('Revoke this invite?')) return;
    setRevoking(true);

    try {
      const res = await fetch(`/api/admin/invites/${inviteId}`, { method: 'DELETE' });
      if (res.ok) window.location.reload();
    } catch (err) {
      console.error('Failed to revoke:', err);
      setRevoking(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={copyInviteLink}>
        <Copy className="h-4 w-4 mr-1" />
        {copied ? 'Copied!' : 'Copy Link'}
      </Button>
      <Button variant="destructive" size="sm" onClick={revokeInvite} loading={revoking}>
        <XCircle className="h-4 w-4 mr-1" />
        Revoke
      </Button>
    </div>
  );
}

export function InviteFormDialog() {
  const [formData, setFormData] = useState({
    email: '',
    role: 'USER',
    expiresInDays: '7',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          role: formData.role,
          expiresInDays: parseInt(formData.expiresInDays),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create invite');
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="invite-email">Email Address</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="user@example.com"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-role">Role</Label>
        <Select value={formData.role} onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}>
          <SelectOption value="USER">User</SelectOption>
          <SelectOption value="MERCHANT">Merchant</SelectOption>
          <SelectOption value="ADMIN">Admin</SelectOption>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-expiry">Expires In (Days)</Label>
        <Input
          id="invite-expiry"
          type="number"
          min="1"
          max="90"
          value={formData.expiresInDays}
          onChange={(e) => setFormData(prev => ({ ...prev, expiresInDays: e.target.value }))}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4" /> : 'Create Invite'}
        </Button>
      </DialogFooter>
    </form>
  );
}
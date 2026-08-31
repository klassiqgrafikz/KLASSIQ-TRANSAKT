'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@klassiq-transakt/ui/components/Card';
import { Alert, AlertDescription } from '@klassiq-transakt/ui/components/Alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@klassiq-transakt/ui/components/Dialog';
import { cn } from '@klassiq-transakt/ui/lib/utils';
import { User, Mail, Shield, Bell, Key, Trash2, CheckCircle, AlertCircle, Monitor, Plus, Eye, EyeOff, Lock } from 'lucide-react';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'api' | 'danger'>('profile');

  const [profile, setProfile] = useState({ name: '', email: '' });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false,
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);

  const [notifications, setNotifications] = useState({
    emailDeposits: true,
    emailWithdrawals: true,
    emailTrades: true,
    emailRateAlerts: true,
    emailMarketing: false,
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePw, setShowDeletePw] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'danger', label: 'Danger Zone', icon: AlertCircle },
  ] as const;

  useEffect(() => {
    let alive = true;
    fetch('/api/settings/profile')
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load profile');
        const data = await r.json();
        if (alive) setProfile({ name: data.name ?? '', email: data.email ?? session?.user?.email ?? '' });
      })
      .catch(() => {
        if (alive && session?.user) setProfile({ name: session.user.name ?? '', email: session.user.email ?? '' });
      })
      .finally(() => {
        if (alive) setProfileLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session?.user?.email, session?.user?.name]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!profile.name.trim()) {
      setError('Full name is required');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save profile');
      setProfile({ name: data.name, email: data.email });
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (security.newPassword !== security.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (security.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    setSecuritySaving(true);
    try {
      const res = await fetch('/api/settings/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: security.currentPassword,
          newPassword: security.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      setSuccess('Password updated successfully');
      setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '', twoFactorEnabled: security.twoFactorEnabled });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSecuritySaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setError('');
    if (deleteConfirm !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/settings/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText: deleteConfirm, password: deletePassword || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete account');
      // Hard delete succeeded — sign out to landing
      await signOut({ callbackUrl: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as typeof activeTab);
              setError('');
              setSuccess('');
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription className="text-sm leading-relaxed">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <div className="h-24 animate-pulse rounded bg-zinc-100 max-w-md" />
            ) : (
              <form className="space-y-4 max-w-md" onSubmit={handleProfileSave}>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="name" value={profile.name} onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))} placeholder="John Doe" className="pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" value={profile.email} className="pl-10 bg-muted" readOnly />
                  </div>
                  <p className="text-xs text-muted-foreground">Email cannot be changed. Contact support if needed.</p>
                </div>
                <Button type="submit" loading={profileSaving}>
                  Save Changes
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password — min 8 characters</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4 max-w-md" onSubmit={handlePasswordChange}>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="currentPassword"
                      type={showCurrent ? 'text' : 'password'}
                      value={security.currentPassword}
                      onChange={(e) => setSecurity((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      className="pl-10 pr-10"
                      required
                    />
                    <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showNew ? 'text' : 'password'}
                      value={security.newPassword}
                      onChange={(e) => setSecurity((prev) => ({ ...prev, newPassword: e.target.value }))}
                      className="pl-10 pr-10"
                      minLength={8}
                      required
                    />
                    <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      value={security.confirmPassword}
                      onChange={(e) => setSecurity((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      className="pl-10 pr-10"
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" loading={securitySaving}>
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Authenticator App</p>
                  <p className="text-sm text-muted-foreground">Use Google Authenticator, Authy, or similar</p>
                </div>
                <Button variant={security.twoFactorEnabled ? 'destructive' : 'default'} onClick={() => setSecurity((prev) => ({ ...prev, twoFactorEnabled: !prev.twoFactorEnabled }))}>
                  {security.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">2FA management is local-only in preview — enable still toggles in UI.</p>
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Active Sessions</CardTitle>
              <CardDescription>Manage your active login sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <SessionRow current />
                <SessionRow device="Chrome on Windows" location="Lagos, NG" time="2 hours ago" />
                <SessionRow device="Safari on iPhone" location="Abuja, NG" time="1 day ago" />
              </div>
              <Button variant="outline" className="w-full mt-4" onClick={() => alert('Revoke other sessions — coming soon')}>
                Revoke All Other Sessions
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Choose what emails you want to receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <NotificationToggle label="Deposit Confirmations" description="Get notified when BTC deposits are confirmed" checked={notifications.emailDeposits} onChange={(checked) => setNotifications((prev) => ({ ...prev, emailDeposits: checked }))} />
            <NotificationToggle label="Withdrawal Confirmations" description="Get notified when NGN withdrawals are processed" checked={notifications.emailWithdrawals} onChange={(checked) => setNotifications((prev) => ({ ...prev, emailWithdrawals: checked }))} />
            <NotificationToggle label="Trade Confirmations" description="Get notified when BTC is converted to NGN" checked={notifications.emailTrades} onChange={(checked) => setNotifications((prev) => ({ ...prev, emailTrades: checked }))} />
            <NotificationToggle label="Rate Alerts" description="Get notified when BTC hits your target rate" checked={notifications.emailRateAlerts} onChange={(checked) => setNotifications((prev) => ({ ...prev, emailRateAlerts: checked }))} />
            <NotificationToggle label="Marketing Updates" description="Receive product updates and tips (optional)" checked={notifications.emailMarketing} onChange={(checked) => setNotifications((prev) => ({ ...prev, emailMarketing: checked }))} />
            <p className="text-xs text-muted-foreground pt-2">Preferences are stored locally in preview. Connect to a notifications API to persist.</p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'api' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Manage your API keys for programmatic access</CardDescription>
              </div>
              <Button onClick={() => alert('Create API Key — coming soon')}>
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">No API keys created yet</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'danger' && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions that permanently affect your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5 gap-4">
              <div className="min-w-0">
                <p className="font-medium text-destructive">Delete Account</p>
                <p className="text-sm text-muted-foreground">Permanently delete your account and all data — cannot be undone. Withdraw all funds first.</p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)} className="shrink-0">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </div>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-destructive">Delete account permanently?</DialogTitle>
                  <DialogDescription>Hard delete — your wallets must be empty, pending trades will block deletion. Type DELETE and optionally your password to confirm.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="deleteConfirm">Type DELETE to confirm</Label>
                    <Input id="deleteConfirm" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deletePassword">Password (optional but recommended)</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="deletePassword" type={showDeletePw ? 'text' : 'password'} value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="pl-10 pr-10" placeholder="••••••••" />
                      <button type="button" onClick={() => setShowDeletePw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                        {showDeletePw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteAccount} loading={deleteLoading} disabled={deleteConfirm !== 'DELETE'}>
                    Permanently Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SessionRow({ current, device = 'Chrome on Windows', location = 'Lagos, NG', time = 'Just now' }: { current?: boolean; device?: string; location?: string; time?: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Monitor className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">
            {device} {current && <span className="ml-2 text-xs text-primary">Current</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            {location} • {time}
          </p>
        </div>
      </div>
      {!current && (
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => alert('Revoke session — coming soon')}>
          Revoke
        </Button>
      )}
    </div>
  );
}

function NotificationToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
      </label>
    </div>
  );
}

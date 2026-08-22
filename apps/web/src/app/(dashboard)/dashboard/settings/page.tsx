'use client';

import { useState } from 'react';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@klassiq-transakt/ui/components/Card';
import { Alert, AlertDescription } from '@klassiq-transakt/ui/components/Alert';
import { formatRelativeTime, cn } from '@klassiq-transakt/ui/lib/utils';
import { User, Mail, Lock, Shield, Bell, Key, Trash2, Loader2, CheckCircle, AlertCircle, Monitor } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'api' | 'danger'>('profile');
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
  });
  
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false,
  });

  const [notifications, setNotifications] = useState({
    emailDeposits: true,
    emailWithdrawals: true,
    emailTrades: true,
    emailRateAlerts: true,
    emailMarketing: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'danger', label: 'Danger Zone', icon: AlertCircle },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
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
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="mb-6">
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
            <form className="space-y-4 max-w-md" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                  disabled
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed. Contact support if needed.</p>
              </div>
              <Button type="submit" loading={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4" /> : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4 max-w-md" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={security.currentPassword}
                    onChange={(e) => setSecurity(prev => ({ ...prev, currentPassword: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={security.newPassword}
                    onChange={(e) => setSecurity(prev => ({ ...prev, newPassword: e.target.value }))}
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={security.confirmPassword}
                    onChange={(e) => setSecurity(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" loading={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4" /> : 'Update Password'}
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
                <Button variant={security.twoFactorEnabled ? 'destructive' : 'default'} onClick={() => setSecurity(prev => ({ ...prev, twoFactorEnabled: !prev.twoFactorEnabled }))}>
                  {security.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </Button>
              </div>
            </CardContent          </Card>

          <Card className="border-destructive">
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
              <Button variant="outline" className="w-full mt-4">Revoke All Other Sessions</Button>
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
            <NotificationToggle
              label="Deposit Confirmations"
              description="Get notified when BTC deposits are confirmed"
              checked={notifications.emailDeposits}
              onChange={(checked) => setNotifications(prev => ({ ...prev, emailDeposits: checked }))}
            />
            <NotificationToggle
              label="Withdrawal Confirmations"
              description="Get notified when NGN withdrawals are processed"
              checked={notifications.emailWithdrawals}
              onChange={(checked) => setNotifications(prev => ({ ...prev, emailWithdrawals: checked }))}
            />
            <NotificationToggle
              label="Trade Confirmations"
              description="Get notified when BTC is converted to NGN"
              checked={notifications.emailTrades}
              onChange={(checked) => setNotifications(prev => ({ ...prev, emailTrades: checked }))}
            />
            <NotificationToggle
              label="Rate Alerts"
              description="Get notified when BTC hits your target rate"
              checked={notifications.emailRateAlerts}
              onChange={(checked) => setNotifications(prev => ({ ...prev, emailRateAlerts: checked }))}
            />
            <NotificationToggle
              label="Marketing Updates"
              description="Receive product updates and tips (optional)"
              checked={notifications.emailMarketing}
              onChange={(checked) => setNotifications(prev => ({ ...prev, emailMarketing: checked }))}
            />
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
              <Button>
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
            <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <div>
                <p className="font-medium text-destructive">Delete Account</p>
                <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
              </div>
              <Button variant="destructive" onClick={() => alert('Account deletion would go here')}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </div>
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
          <p className="font-medium">{device} {current && <span className="ml-2 text-xs text-primary">Current</span>}</p>
          <p className="text-sm text-muted-foreground">{location} • {time}</p>
        </div>
      </div>
      {!current && (
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
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
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
      </label>
    </div>
  );
}
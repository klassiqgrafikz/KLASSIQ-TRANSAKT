'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@klassiq-transakt/ui/components/Card';
import { Select, SelectOption } from '@klassiq-transakt/ui/components/Select';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import { Alert, AlertDescription } from '@klassiq-transakt/ui/components/Alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@klassiq-transakt/ui/components/Dialog';
import { formatNgn, cn } from '@klassiq-transakt/ui/lib/utils';
import { Plus, CheckCircle, Shield, Edit, Trash2, Copy, Loader2, Banknote, Search, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  isDefault: boolean;
  isVerified: boolean;
  createdAt: string;
}

interface Bank {
  code: string;
  name: string;
  slug: string;
}

export default function AccountsPage() {
  const router = useRouter();
  
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    bankCode: '',
    accountNumber: '',
    accountName: '',
  });
  const [verificationResult, setVerificationResult] = useState<{ accountName: string; matched: boolean } | null>(null);

  // Fetch data on mount
  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/banks/my-accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  const fetchBanks = async () => {
    try {
      const res = await fetch('/api/banks');
      if (res.ok) {
        const data = await res.json();
        setBanks(data);
      }
    } catch (err) {
      console.error('Failed to fetch banks:', err);
    }
  };

  // Handle bank code change
  const handleBankCodeChange = (code: string) => {
    setFormData(prev => ({ ...prev, bankCode: code }));
    setVerificationResult(null);
  };

  // Verify account number
  const verifyAccount = async () => {
    if (!formData.bankCode || !formData.accountNumber || formData.accountNumber.length !== 10) {
      setError('Enter a valid 10-digit account number');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const res = await fetch('/api/banks/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankCode: formData.bankCode,
          accountNumber: formData.accountNumber,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setVerificationResult(data);
        setFormData(prev => ({ ...prev, accountName: data.accountName }));
      } else {
        const err = await res.json();
        setError(err.error || 'Verification failed');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Add bank account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.bankCode || !formData.accountNumber || !formData.accountName) {
      setError('Fill in all fields');
      return;
    }

    if (formData.accountNumber.length !== 10) {
      setError('Account number must be 10 digits');
      return;
    }

    setIsAdding(true);

    try {
      const res = await fetch('/api/banks/my-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add account');
      }

      setShowAddDialog(false);
      setFormData({ bankCode: '', accountNumber: '', accountName: '' });
      setVerificationResult(null);
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setIsAdding(false);
    }
  };

  // Set default account
  const setDefaultAccount = async (accountId: string) => {
    try {
      const res = await fetch(`/api/banks/my-accounts/${accountId}/default`, {
        method: 'POST',
      });
      
      if (res.ok) {
        await fetchAccounts();
      }
    } catch (err) {
      console.error('Failed to set default:', err);
    }
  };

  // Delete account
  const deleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;

    try {
      const res = await fetch(`/api/banks/my-accounts/${accountId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        await fetchAccounts();
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bank Accounts</h1>
          <p className="text-muted-foreground">Manage your Nigerian bank accounts for NGN withdrawals</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Bank Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddAccount} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="bankCode">Bank</Label>
                <Select
                  value={formData.bankCode}
                  onChange={(e) => handleBankCodeChange(e.target.value)}
                  disabled={isAdding}
                >
                  <SelectOption value="" disabled>Select your bank</SelectOption>
                  {banks.map((bank) => (
                    <SelectOption key={bank.code} value={bank.code}>
                      {bank.name}
                    </SelectOption>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number (10 digits)</Label>
                <div className="flex gap-2">
                  <Input
                    id="accountNumber"
                    type="text"
                    placeholder="0123456789"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                    maxLength={10}
                    disabled={isAdding}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={verifyAccount}
                    loading={isVerifying}
                    disabled={isAdding || !formData.bankCode || formData.accountNumber.length !== 10}
                  >
                    {isVerifying ? <Loader2 className="h-4 w-4" /> : 'Verify'}
                  </Button>
                </div>
                {verificationResult && (
                  <p className={cn('text-sm', verificationResult.matched ? 'text-green-600' : 'text-red-600')}>
                    {verificationResult.matched ? '✓' : '✗'} {verificationResult.accountName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  value={formData.accountName}
                  onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                  disabled={isAdding}
                  placeholder="As shown on verification"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isAdding}>
                  {isAdding ? <Loader2 className="h-4 w-4" /> : 'Add Account'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bank Directory Link */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Banknote className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Need to find a bank code?</p>
            <p className="text-sm text-muted-foreground">Browse all 20+ supported Nigerian banks</p>
          </div>
        </div>
        <Link href="/banks">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Browse Banks
          </Button>
        </Link>
      </div>

      {/* Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Accounts</CardTitle>
          <CardDescription>{accounts.length} account{accounts.length !== 1 ? 's' : ''} connected</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No bank accounts yet</h3>
              <p className="text-muted-foreground mb-6">Add a bank account to receive NGN withdrawals</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-lg border transition-colors',
                    account.isDefault ? 'border-primary/50 bg-primary/5' : 'border-muted hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Banknote className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{account.bankName}</h3>
                        {account.isDefault && (
                          <Badge variant="default" className="text-xs">Default</Badge>
                        )}
                        {account.isVerified && (
                          <Badge variant="success" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" /> Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {account.accountName} • ••••{account.accountNumber.slice(-4)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!account.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefaultAccount(account.id)}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(account.accountNumber)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteAccount(account.id)}
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

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <InfoItem
              icon={<Shield className="h-5 w-5" />}
              title="Verified Accounts"
              description="We verify account names via NIBSS to prevent errors"
            />
            <InfoItem
              icon={<Banknote className="h-5 w-5" />}
              title="20+ Banks Supported"
              description="GTB, Access, UBA, Zenith, and all major Nigerian banks"
            />
            <InfoItem
              icon={<ExternalLink className="h-5 w-5" />}
              title="Multiple Accounts"
              description="Add multiple accounts, set one as default for withdrawals"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}
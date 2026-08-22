'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@klassiq-transakt/ui/components/Card';
import { Select, SelectOption } from '@klassiq-transakt/ui/components/Select';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import { Alert, AlertDescription, AlertTitle } from '@klassiq-transakt/ui/components/Alert';
import { Dialog, AlertDialog } from '@klassiq-transakt/ui/components/Dialog';
import { formatNgn, formatBtc, cn } from '@klassiq-transakt/ui/lib/utils';
import { Bitcoin, ArrowRight, Loader2, AlertCircle, CheckCircle, XCircle, QRCode, Copy, Trash2, Edit, ExternalLink, DollarSign, TrendingUp, RefreshCw, Shield } from 'lucide-react';

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  isDefault: boolean;
  isVerified: boolean;
}

interface RateQuote {
  rate: number;
  fee: number;
  expiresAt: string;
  provider: string;
}

interface DepositAddress {
  address: string;
  network: 'BITCOIN' | 'LIGHTNING';
  qrCode?: string;
  depositId: string;
  expiresAt?: string;
}

export default function TradePage() {
  const router = useRouter();
  
  // State
  const [step, setStep] = useState<'amount' | 'confirm' | 'deposit' | 'complete'>('amount');
  const [btcAmount, setBtcAmount] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [rateQuote, setRateQuote] = useState<RateQuote | null>(null);
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [depositConfirmed, setDepositConfirmed] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch banks on mount
  useEffect(() => {
    fetchBanks();
    fetchCurrentRate();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [pollingInterval]);

  const fetchBanks = async () => {
    try {
      const res = await fetch('/api/banks/my-accounts');
      if (res.ok) {
        const data = await res.json();
        setBanks(data);
        // Auto-select default bank
        const defaultBank = data.find((b: BankAccount) => b.isDefault);
        if (defaultBank) setSelectedBankId(defaultBank.id);
      }
    } catch (err) {
      console.error('Failed to fetch banks:', err);
    }
  };

  const fetchCurrentRate = async () => {
    try {
      const res = await fetch('/api/rates/btc-ngn');
      if (res.ok) {
        const data = await res.json();
        setRateQuote(data);
      }
    } catch (err) {
      console.error('Failed to fetch rate:', err);
    }
  };

  const handleAmountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!btcAmount || parseFloat(btcAmount) <= 0) {
      setError('Enter a valid BTC amount');
      return;
    }

    if (!selectedBankId) {
      setError('Select a bank account');
      return;
    }

    setIsLoading(true);
    try {
      // Get fresh quote for this amount
      const res = await fetch('/api/trade/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ btcAmount: parseFloat(btcAmount) }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to get quote');
      }

      const quote = await res.json();
      setRateQuote(quote);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmTrade = async () => {
    setError('');
    setIsLoading(true);
    setShowConfirmDialog(false);

    try {
      // Create deposit address
      const res = await fetch('/api/trade/create-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          btcAmount: parseFloat(btcAmount),
          bankAccountId: selectedBankId,
          network: 'LIGHTNING', // Default to Lightning
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create deposit address');
      }

      const deposit = await res.json();
      setDepositAddress(deposit);
      setStep('deposit');
      startDepositPolling(deposit.depositId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deposit');
      setStep('amount');
    } finally {
      setIsLoading(false);
    }
  };

  const startDepositPolling = (depositId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/trade/deposit-status/${depositId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'COMPLETED') {
            clearInterval(interval);
            setDepositConfirmed(true);
            setStep('complete');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);

    setPollingInterval(interval);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast notification here
  };

  const handleNewTrade = () => {
    setStep('amount');
    setBtcAmount('');
    setRateQuote(null);
    setDepositAddress(null);
    setDepositConfirmed(false);
    setError('');
  };

  const selectedBank = banks.find(b => b.id === selectedBankId);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between">
        {['Amount', 'Confirm', 'Deposit', 'Complete'].map((label, index) => {
          const stepOrder = ['amount', 'confirm', 'deposit', 'complete'];
          const isActive = stepOrder.indexOf(step) >= index;
          const isCurrent = stepOrder[stepOrder.indexOf(step)] === step;
          return (
            <div key={label} className="flex flex-col items-center">
              <div className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                {isCurrent && step !== 'complete' && <Loader2 className="h-5 w-5 animate-spin" />}
                {step === 'complete' && index === 3 && <CheckCircle className="h-5 w-5" />}
                {!isActive && !isCurrent && index < stepOrder.indexOf(step) && <CheckCircle className="h-5 w-5" />}
                {!isActive && index > stepOrder.indexOf(step) && index + 1}
              </div>
              <span className={cn('mt-1 text-xs text-center', isActive ? 'font-medium' : 'text-muted-foreground')}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Enter Amount */}
      {step === 'amount' && (
        <Card>
          <CardHeader>
            <CardTitle>Convert Bitcoin to Naira</CardTitle>
            <CardDescription>Enter the amount of BTC you want to sell</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAmountSubmit} className="space-y-6">
              {/* BTC Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="btcAmount">BTC Amount</Label>
                <div className="relative">
                  <Input
                    id="btcAmount"
                    type="number"
                    step="0.00000001"
                    min="0.00001"
                    placeholder="0.001"
                    value={btcAmount}
                    onChange={(e) => setBtcAmount(e.target.value)}
                    className="text-2xl font-mono text-center pl-10"
                    disabled={isLoading}
                  />
                  <Bitcoin className="absolute left-3 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                </div>
              </div>

              {/* Live Rate Display */}
              {rateQuote && (
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Current Rate</span>
                    <Badge variant="outline" className="text-xs">{rateQuote.provider}</Badge>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-bold font-mono">{formatNgn(rateQuote.rate)}</span>
                    <span className="text-muted-foreground">per BTC</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Fee: {formatNgn(rateQuote.fee)} • Expires in <span id="rate-expiry">60s</span>
                  </div>
                </div>
              )}

              {/* Bank Selection */}
              <div className="space-y-2">
                <Label htmlFor="bankAccount">Withdraw to Bank Account</Label>
                <Select
                  id="bankAccount"
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  disabled={isLoading}
                >
                  <SelectOption value="" disabled>Select a bank account</SelectOption>
                  {banks.map((bank) => (
                    <SelectOption key={bank.id} value={bank.id}>
                      {bank.bankName} • ••••{bank.accountNumber.slice(-4)} {bank.isDefault && '(Default)'}
                    </SelectOption>
                  ))}
                  {banks.length === 0 && (
                    <SelectOption value="" disabled>No bank accounts added</SelectOption>
                  )}
                </Select>
                {banks.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    <a href="/dashboard/accounts" className="text-primary hover:underline">Add a bank account first</a>
                  </p>
                )}
              </div>

              {/* Estimated NGN */}
              {btcAmount && rateQuote && (
                <div className="p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Estimated You'll Receive</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-green-700 dark:text-green-300 mt-1">
                    {formatNgn(parseFloat(btcAmount) * rateQuote.rate - rateQuote.fee)}
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" loading={isLoading}>
                {isLoading ? <Loader2 className="h-5 w-5" /> : 'Get Quote & Continue'}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-xs text-muted-foreground">
              Minimum trade: ₦1,000 • Platform fee: 0.5% included in rate
            </p>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Confirm Trade */}
      {step === 'confirm' && rateQuote && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm Your Trade</CardTitle>
            <CardDescription>Review the details before creating your deposit address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">You Send</p>
                <p className="text-2xl font-bold font-mono text-orange-500">{formatBtc(parseFloat(btcAmount))}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Rate</p>
                <p className="text-2xl font-bold font-mono">{formatNgn(rateQuote.rate)}/BTC</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Fee</p>
                <p className="text-2xl font-bold font-mono">{formatNgn(rateQuote.fee)}</p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <p className="text-sm text-muted-foreground">You Receive</p>
                <p className="text-2xl font-bold font-mono text-green-700">
                  {formatNgn(parseFloat(btcAmount) * rateQuote.rate - rateQuote.fee)}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Depositing to: {selectedBank?.bankName} ••••{selectedBank?.accountNumber.slice(-4)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedBank?.accountName} • {selectedBank?.isVerified ? 'Verified' : 'Unverified'}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('amount')} className="flex-1">
              Go Back
            </Button>
            <Button onClick={() => setShowConfirmDialog(true)} className="flex-1" loading={isLoading}>
              Create Deposit Address
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Deposit */}
      {step === 'deposit' && depositAddress && (
        <Card>
          <CardHeader>
            <CardTitle>Send Bitcoin to This Address</CardTitle>
            <CardDescription>
              Deposit exactly <strong className="font-mono">{formatBtc(parseFloat(btcAmount))}</strong> to the address below.
              {depositAddress.network === 'LIGHTNING' && ' Lightning invoices expire in 1 hour.'}
              {depositAddress.network === 'BITCOIN' && ' On-chain deposits require 1 confirmation.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code */}
            <div className="text-center">
              {depositAddress.qrCode ? (
                <img
                  src={`data:image/png;base64,${depositAddress.qrCode}`}
                  alt="Deposit QR Code"
                  className="mx-auto h-64 w-64 rounded-lg border p-4 bg-white"
                />
              ) : (
                <div className="mx-auto h-64 w-64 flex items-center justify-center rounded-lg border bg-muted/50">
                  <QRCode className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Address */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between mb-2">
                <Label>{depositAddress.network} Address</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(depositAddress.address)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <code className="text-sm font-mono break-all block">{depositAddress.address}</code>
            </div>

            {/* Amount Reminder */}
            <Alert>
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                Send exactly <strong>{formatBtc(parseFloat(btcAmount))}</strong>.
                Sending more or less may delay or fail the conversion.
                {depositAddress.expiresAt && (
                  <> Expires: {new Date(depositAddress.expiresAt).toLocaleTimeString()}</>
                )}
              </AlertDescription>
            </Alert>

            {/* Polling Status */}
            <div className="text-center text-sm text-muted-foreground">
              {depositConfirmed ? (
                <span className="text-green-600 flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Deposit confirmed! Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking for deposit...
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleNewTrade} className="flex-1">
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button variant="secondary" onClick={fetchCurrentRate} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Rate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && depositAddress && (
        <Card className="border-green-200">
          <CardHeader className="text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mx-auto mb-4">
              <CheckCircle className="h-8 w-8" />
            </div>
            <CardTitle>Conversion Complete!</CardTitle>
            <CardDescription>Your Bitcoin has been converted and NGN is on the way to your bank</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">BTC Sold</p>
                <p className="text-xl font-bold font-mono text-orange-500">{formatBtc(parseFloat(btcAmount))}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">Rate</p>
                <p className="text-xl font-bold font-mono">{rateQuote ? formatNgn(rateQuote.rate) : '—'}/BTC</p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-center">
                <p className="text-sm text-muted-foreground">NGN Sent</p>
                <p className="text-xl font-bold font-mono text-green-700">
                  {rateQuote ? formatNgn(parseFloat(btcAmount) * rateQuote.rate - rateQuote.fee) : '—'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Sent to: {selectedBank?.bankName} ••••{selectedBank?.accountNumber.slice(-4)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedBank?.accountName} • Usually arrives within 5 minutes
              </p>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              You'll receive an email confirmation shortly.
            </div>
          </CardContent>
          <CardFooter className="flex justify-center gap-3">
            <Link href="/dashboard/transactions">
              <Button variant="outline">View Transaction</Button>
            </Link>
            <Button onClick={handleNewTrade}>
              <Bitcoin className="h-4 w-4 mr-2" />
              Convert More
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Confirm Dialog */}
      <AlertDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Create Deposit Address?"
        description={`This will generate a ${depositAddress?.network || 'Lightning'} deposit address for ${formatBtc(parseFloat(btcAmount))}. You'll need to send the exact amount to proceed.`}
        confirmText="Create Address"
        cancelText="Cancel"
        onConfirm={handleConfirmTrade}
        loading={isLoading}
      />
    </div>
  );
}
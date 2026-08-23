'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Select, SelectOption } from '@klassiq-transakt/ui/components/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@klassiq-transakt/ui/components/Dialog';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import { Alert, AlertDescription, AlertTitle } from '@klassiq-transakt/ui/components/Alert';
import { cn, formatNgn } from '@klassiq-transakt/ui/lib/utils';
import {
  Wallet as WalletIcon, Copy, CheckCircle2, Loader2, ArrowDownToLine,
  ArrowUpFromLine, Zap, RefreshCw, Info,
} from 'lucide-react';

interface WalletRow {
  currency: string;
  balance: number;
  locked: number;
  staked?: number;
  isCrypto: boolean;
  convertedNgn: number;
}

interface AddressInfo {
  id: string;
  currency: string;
  address: string;
  network?: string | null;
  destinationTag?: string | null;
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [totalNgn, setTotalNgn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // modals
  const [depositCoin, setDepositCoin] = useState<string | null>(null);
  const [withdrawCoin, setWithdrawCoin] = useState<WalletRow | null>(null);
  const [ngnWithdrawOpen, setNgnWithdrawOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/wallets');
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || 'Failed to load wallets');
      setWallets(json.wallets ?? []);
      setTotalNgn(json.totalNgn ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load wallets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-lg font-bold">Wallets</h1>
          <p className="text-xs text-muted-foreground">
            Balances held on your linked Quidax account · valued in NGN
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-accent" title="Refresh">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
        <Button onClick={() => setNgnWithdrawOpen(true)} variant="outline" size="sm" className="h-9">
          ₦ Withdraw to Bank
        </Button>
      </div>

      {/* Total + auto-offramp status */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Estimated Total Value</p>
          <p className="text-3xl font-bold font-mono tabular-nums mt-1">{formatNgn(totalNgn)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Auto-Offramp Engine</p>
            <Badge variant="success" className="ml-auto">ACTIVE</Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Any BTC deposited to your addresses is automatically sold at market and paid out
            to your default bank account. Manage the pipeline via{' '}
            <code className="text-[10px] bg-muted px-1 rounded">/admin</code>.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <Info />
          <AlertTitle>Couldn't load wallets</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
              <th className="px-4 py-3">Currency</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">Locked</th>
              <th className="px-4 py-3 text-right">Est. Value</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && wallets.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                  ))}
                </tr>
              ))
            ) : wallets.filter(w => w.balance > 0 || w.locked > 0).length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                No funded wallets yet — deposit BTC or buy on the terminal first.
              </td></tr>
            ) : (
              wallets.filter(w => w.balance > 0 || w.locked > 0).map(w => (
                <tr key={w.currency} className="border-b border-border/50 hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-full bg-primary/15 text-primary grid place-items-center text-[10px] font-bold uppercase">
                        {w.currency.slice(0, 3)}
                      </span>
                      <span className="font-semibold uppercase">{w.currency}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                    {w.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-muted-foreground hidden md:table-cell">
                    {w.locked > 0 ? w.locked : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                    {w.convertedNgn > 0 ? formatNgn(w.convertedNgn) : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => setDepositCoin(w.currency)}>
                        <ArrowDownToLine className="h-3 w-3 mr-1" /> Deposit
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        disabled={w.balance <= 0}
                        onClick={() => setWithdrawCoin(w)}>
                        <ArrowUpFromLine className="h-3 w-3 mr-1" /> Withdraw
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {depositCoin && (
        <DepositModal coin={depositCoin} onClose={() => setDepositCoin(null)} />
      )}
      {withdrawCoin && (
        <WithdrawModal wallet={withdrawCoin} onClose={() => setWithdrawCoin(null)} onDone={load} />
      )}
      {ngnWithdrawOpen && (
        <NgnWithdrawModal onClose={() => setNgnWithdrawOpen(false)} onDone={load} />
      )}
    </div>
  );
}

/* ─────────────── DEPOSIT MODAL ─────────────── */

function DepositModal({ coin, onClose }: { coin: string; onClose: () => void }) {
  const [address, setAddress] = useState<AddressInfo | null>(null);
  const [allAddresses, setAllAddresses] = useState<AddressInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [pendingNote, setPendingNote] = useState('');

  const fetchAddress = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/wallets/deposit-address?currency=${coin}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setAddress(json.address);
      if (json.all) setAllAddresses(json.all);
      setPendingNote(json.message ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load address');
    } finally {
      setLoading(false);
    }
  }, [coin]);

  useEffect(() => { fetchAddress(); }, [fetchAddress]);

  // If generation was async, poll a few times for the address to appear
  useEffect(() => {
    if (!pendingNote) return;
    let tries = 0;
    const id = setInterval(async () => {
      tries++;
      try {
        const res = await fetch(`/api/wallets/deposit-address?currency=${coin}`);
        const json = await res.json();
        if (json.address?.address) {
          setAddress(json.address);
          setPendingNote('');
          clearInterval(id);
        }
        if (tries >= 6) clearInterval(id);
      } catch { /* keep polling */ }
    }, 5000);
    return () => clearInterval(id);
  }, [pendingNote, coin]);

  const copy = () => {
    if (address?.address) navigator.clipboard.writeText(address.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateNew = async () => {
    setGenerating(true);
    try {
      await fetch('/api/wallets/deposit-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: coin }),
      });
      await fetchAddress();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="theme-terminal max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase">Deposit {coin}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Fetching your address…</p>
          </div>
        ) : error ? (
          <Alert variant="destructive"><Info /><AlertDescription>{error}</AlertDescription></Alert>
        ) : address?.address ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">
                {coin.toUpperCase()} address{address.network ? ` · ${address.network}` : ''}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs break-all font-mono leading-relaxed">{address.address}</code>
                <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {allAddresses.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">All your {coin.toUpperCase()} addresses:</p>
                {allAddresses.map(a => (
                  <div key={a.id} className="text-[11px] font-mono flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="truncate">{a.network || 'default'}:</span>
                    <button onClick={() => navigator.clipboard.writeText(a.address)} className="underline truncate max-w-[220px]">
                      {a.address}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 text-blue-300 text-xs">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Deposits credit automatically after network confirmations.
                Sending a different asset to this address may result in permanent loss.
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={generateNew} loading={generating}>
              Generate New Address
            </Button>
          </div>
        ) : pendingNote ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{pendingNote}</p>
          </div>
        ) : (
          <div className="space-y-4 text-center py-4">
            <WalletIcon className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No address yet.</p>
            <Button className="w-full" onClick={generateNew} loading={generating}>
              Generate {coin.toUpperCase()} Address
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── CRYPTO WITHDRAW MODAL ─────────────── */

function WithdrawModal({ wallet, onClose, onDone }: { wallet: WalletRow; onClose: () => void; onDone: () => void }) {
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const amountNum = parseFloat(amount) || 0;
  const insufficient = amountNum > wallet.balance;

  const submit = async () => {
    setFeedback(null);
    if (!address || address.length < 10) return setFeedback({ ok: false, msg: 'Enter a valid destination address' });
    if (insufficient) return setFeedback({ ok: false, msg: `Max available: ${wallet.balance}` });

    if (!confirm(`Send ${amountNum} ${wallet.currency.toUpperCase()}?\n\nTo: ${address}${network ? `\nNetwork: ${network}` : ''}\n\nThis cannot be undone.`)) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/wallets/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'crypto',
          currency: wallet.currency,
          amount: amountNum,
          address,
          ...(network ? { network } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setFeedback({ ok: true, msg: `Withdrawal submitted — ref ${json.txnId.slice(0, 10)}…` });
      setTimeout(onClose, 1800);
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : 'Failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="theme-terminal max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase">Withdraw {wallet.currency}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-300 text-xs">
            Available: <b>{wallet.balance} {wallet.currency.toUpperCase()}</b> · Network fees are
            deducted by Quidax at processing time.
          </div>

          <label className="block space-y-1">
            <Label>Destination Address</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)}
              placeholder={`Paste ${wallet.currency.toUpperCase()} address`} className="font-mono text-xs" />
          </label>

          <label className="block space-y-1">
            <Label>Network <span className="text-muted-foreground">(optional — required by some chains)</span></Label>
            <Input value={network} onChange={e => setNetwork(e.target.value)}
              placeholder="e.g. trc20, bep20, bitcoin" className="font-mono text-xs" />
          </label>

          <label className="block space-y-1">
            <Label>Amount</Label>
            <div className="flex gap-2">
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" className="font-mono tabular-nums" />
              <Button variant="outline" size="sm" type="button"
                onClick={() => setAmount(String(wallet.balance))}>Max</Button>
            </div>
            {insufficient && <p className="text-xs text-red-400 mt-1">Exceeds available balance</p>}
          </label>

          {feedback && (
            <div className={cn('p-2.5 rounded-lg text-xs', feedback.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
              {feedback.msg}
            </div>
          )}

          <Button
            className={cn('w-full h-10 text-white',
              insufficient ? 'bg-zinc-700 hover:bg-zinc-700 cursor-not-allowed' : wallet.isCrypto ? 'bg-orange-600 hover:bg-orange-700' : '')}
            onClick={submit}
            disabled={submitting || insufficient}
            loading={submitting}
          >
            Confirm Withdrawal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── NGN BANK WITHDRAW MODAL ─────────────── */

function NgnWithdrawModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [accounts, setAccounts] = useState<{ id: string; bankName: string; accountNumber: string; accountName: string }[]>([]);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/banks/my-accounts');
        if (res.ok) {
          const list = await res.json();
          setAccounts(list);
          const def = list.find((a: any) => a.isDefault) ?? list[0];
          if (def) setAccountId(def.id);
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const submit = async () => {
    const amt = parseFloat(amount) || 0;
    if (!accountId) return setFeedback({ ok: false, msg: 'Select a bank account' });
    if (amt <= 0) return setFeedback({ ok: false, msg: 'Enter an amount' });

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/wallets/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ngn', amount: amt, bankAccountId: accountId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setFeedback({ ok: true, msg: `₦${amt.toLocaleString()} withdrawal submitted!` });
      setTimeout(() => { onDone(); onClose(); }, 1600);
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : 'Failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="theme-terminal max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw NGN to Bank</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : accounts.length === 0 ? (
          <div className="space-y-4 text-center py-4">
            <p className="text-sm text-muted-foreground">No bank accounts yet.</p>
            <Button onClick={onClose} variant="outline" className="w-full">
              Add one under Classic → Bank Accounts
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block space-y-1">
              <Label>Bank Account</Label>
              <Select value={accountId} onChange={e => setAccountId(e.target.value)}>
                {accounts.map(a => (
                  <SelectOption key={a.id} value={a.id}>
                    {a.bankName} • ••••{a.accountNumber.slice(-4)} — {a.accountName}
                  </SelectOption>
                ))}
              </Select>
            </label>

            <label className="block space-y-1">
              <Label>Amount (NGN)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="10000" className="font-mono tabular-nums" />
            </label>

            <p className="text-xs text-muted-foreground">
              Quidax charges ₦200 flat + ₦50 stamp duty per payout (≥₦10k).
            </p>

            {feedback && (
              <div className={cn('p-2.5 rounded-lg text-xs', feedback.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                {feedback.msg}
              </div>
            )}

            <Button className="w-full h-10" onClick={submit} loading={submitting}>
              Withdraw NGN
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
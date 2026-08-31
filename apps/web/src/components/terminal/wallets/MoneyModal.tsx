'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Label } from '@klassiq-transakt/ui/components/Label';
import { Select, SelectOption } from '@klassiq-transakt/ui/components/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@klassiq-transakt/ui/components/Dialog';
import { Alert } from '@klassiq-transakt/ui/components/Alert';
import { cn, formatNgn } from '@klassiq-transakt/ui/lib/utils';
import {
  Bitcoin, Banknote, Copy, CheckCircle2, Loader2, Info,
  ArrowLeft, RefreshCw, ExternalLink,
} from 'lucide-react';

export type MoneyIntent = 'deposit' | 'withdraw';
type Category = 'crypto' | 'cash' | null;

const CASH_COINS = [
  { value: 'usdt', label: 'USDT' },
  { value: 'btc', label: 'BTC' },
  { value: 'usdc', label: 'USDC' },
];

interface Props {
  intent: MoneyIntent;
  wallets: { currency: string; balance: number }[];
  userEmail?: string | null;
  userName?: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export default function MoneyModal({ intent, wallets, userEmail, userName, onClose, onChanged }: Props) {
  const title = intent === 'deposit' ? 'Deposit' : 'Withdraw';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="theme-terminal max-w-md">
        <DialogHeader>
          <DialogTitle>{title} Funds</DialogTitle>
        </DialogHeader>
        <CategoryChooser intent={intent} wallets={wallets} userEmail={userEmail} userName={userName}
          onClose={onClose} onChanged={onChanged} />
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── STEP 0: CATEGORY CHOOSER ───────────── */

function CategoryChooser(props: {
  intent: MoneyIntent; wallets: Props['wallets'];
  userEmail?: string | null; userName?: string | null;
  onClose: () => void; onChanged: () => void;
}) {
  const [category, setCategory] = useState<'crypto' | 'cash' | null>(null);
  if (!category) {
    return (
      <div className="grid grid-cols-2 gap-3 py-2">
        <button onClick={() => setCategory('crypto')}
          className="flex flex-col items-center gap-3 rounded-xl border border-border p-6 hover:border-primary/60 hover:bg-primary/5 transition-colors">
          <Bitcoin className="h-7 w-7 text-orange-400" />
          <span className="font-semibold text-sm">{props.intent === 'deposit' ? 'Crypto' : 'Crypto'}</span>
          <span className="text-[11px] text-muted-foreground text-center leading-snug">
            {props.intent === 'deposit'
              ? 'On-chain transfer to your address'
              : 'Send to an external wallet'}
          </span>
        </button>
        <button onClick={() => setCategory('cash')}
          className="flex flex-col items-center gap-3 rounded-xl border border-border p-6 hover:border-primary/60 hover:bg-primary/5 transition-colors">
          <Banknote className="h-7 w-7 text-emerald-400" />
          <span className="font-semibold text-sm">{props.intent === 'deposit' ? 'Cash (NGN)' : 'Cash (NGN)'}</span>
          <span className="text-[11px] text-muted-foreground text-center leading-snug">
            {props.intent === 'deposit'
              ? 'Bank transfer → instant credit'
              : 'Straight to your bank account'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setCategory(null)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Change method
      </button>

      {props.intent === 'deposit' && category === 'crypto' && <DepositCrypto {...props} />}
      {props.intent === 'deposit' && category === 'cash' && <DepositCash {...props} />}
      {props.intent === 'withdraw' && category === 'crypto' && <WithdrawCrypto {...props} />}
      {props.intent === 'withdraw' && category === 'cash' && <WithdrawCash {...props} />}
    </div>
  );
}

/* ───────────── DEPOSIT · CRYPTO ───────────── */

function DepositCrypto({ wallets }: Props) {
  const coins = useMemoCoinList(wallets);
  const [coin, setCoin] = useState(coins[0] ?? 'btc');
  const [network, setNetwork] = useState('');
  const [addr, setAddr] = useState<{ address: string; network?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [pendingMsg, setPendingMsg] = useState('');

  const fetchAddr = useCallback(async () => {
    setLoading(true);
    setPendingMsg('');
    setGenError('');
    try {
      const r = await fetch(`/api/wallets/deposit-address?currency=${coin}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed to fetch address');
      setAddr(j.address ?? null);
      if (!j.address?.address && j.note) setPendingMsg(j.note);
    } catch (e) {
      setAddr(null);
      setGenError(e instanceof Error ? e.message : 'Failed to fetch address');
    } finally {
      setLoading(false);
    }
  }, [coin]);

  useEffect(() => {
    fetchAddr();
  }, [fetchAddr]);

  useEffect(() => {
    setNetwork(defaultNetwork(coin));
  }, [coin]);

  const generate = async () => {
    setGenerating(true);
    setGenError('');
    setPendingMsg('');
    try {
      const net = network || defaultNetwork(coin);
      const r = await fetch('/api/wallets/deposit-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: coin, ...(net ? { network: net } : {}) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Generation failed');
      if (j.address?.address) {
        setAddr(j.address);
        setPendingMsg('');
      } else {
        setPendingMsg(j.message || 'Address is being generated — check again in a few seconds.');
        // auto-poll once after 4s
        setTimeout(() => fetchAddr(), 4000);
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <CoinPicker coins={coins} coin={coin} onChange={setCoin} />
      {loading ? (
        <CenterSpin />
      ) : addr?.address ? (
        <>
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">
              {coin.toUpperCase()} address{addr.network ? ` · ${addr.network}` : ''}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs break-all font-mono">{addr.address}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(addr.address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <InfoNote>Credits after network confirmations. Wrong asset sent here is lost.</InfoNote>
          <Button size="sm" variant="ghost" className="w-full text-xs" onClick={fetchAddr}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh address
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="p-4 rounded-lg border border-dashed bg-muted/20 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No {coin.toUpperCase()} address yet for your personal wallet.</p>
            <p className="text-xs text-muted-foreground">Each account has isolated addresses — generate yours below.</p>
          </div>

          {(coin === 'usdt' || coin === 'usdc' || coin === 'eth') && (
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">Network</span>
              <Select value={network} onChange={(e) => setNetwork(e.target.value)}>
                {coin === 'usdt' && (
                  <>
                    <SelectOption value="trc20">TRC20 (Tron)</SelectOption>
                    <SelectOption value="bep20">BEP20 (BSC)</SelectOption>
                    <SelectOption value="erc20">ERC20 (Ethereum)</SelectOption>
                  </>
                )}
                {coin === 'usdc' && (
                  <>
                    <SelectOption value="bep20">BEP20 (BSC)</SelectOption>
                    <SelectOption value="erc20">ERC20 (Ethereum)</SelectOption>
                    <SelectOption value="trc20">TRC20 (Tron)</SelectOption>
                  </>
                )}
                {coin === 'eth' && <SelectOption value="erc20">ERC20 (Ethereum)</SelectOption>}
              </Select>
            </label>
          )}

          {genError && <Feedback ok={false} msg={genError} />}
          {pendingMsg && <Feedback ok={false} msg={pendingMsg} />}

          <Button className="w-full" onClick={generate} loading={generating} disabled={generating}>
            Generate {coin.toUpperCase()} Address{network ? ` (${network})` : ''}
          </Button>
          <Button size="sm" variant="ghost" className="w-full text-xs" onClick={fetchAddr}>
            <RefreshCw className="h-3 w-3 mr-1" /> I already generated — refresh
          </Button>
        </div>
      )}
    </div>
  );
}

/* ───────────── DEPOSIT · CASH ───────────── */

function DepositCash({ userEmail, userName, onChanged }: Props) {
  const [toCoin, setToCoin] = useState('usdt');
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState('');
  const [stage, setStage] = useState<'form' | 'awaiting'>('form');
  const [bankDetails, setBankDetails] = useState<{
    accountNumber: string; bankName: string; accountName: string;
    amountExpected: number; processorFee?: number; merchantReference: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean | null; msg: string } | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number>(-1);

  const amt = parseFloat(amount) || 0;

  const start = async () => {
    setStatusMsg(null);
    setSubmitting(true);
    try {
      // Destination = owner's own address for chosen coin
      const addrRes = await fetch(`/api/wallets/deposit-address?currency=${toCoin}`);
      const addrJson = await addrRes.json();
      const destAddress: string | undefined = addrJson.address?.address;

      const res = await fetch('/api/ramp/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toCurrency: toCoin,
          amountNgn: amt,
          network: network || defaultNetwork(toCoin),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || 'Failed');

      setBankDetails({
        accountNumber: json.accountNumber,
        bankName: json.bankName,
        accountName: json.accountName,
        amountExpected: json.amountExpected,
        processorFee: json.processorFee,
        merchantReference: json.merchantReference,
      });
      void destAddress;
      setStage('awaiting');
      onChanged();
    } catch (e) {
      setStatusMsg({ ok: false, msg: e instanceof Error ? e.message : 'Failed' });
    } finally { setSubmitting(false); }
  };

  // Poll while awaiting payment
  useEffect(() => {
    if (stage !== 'awaiting' || !bankDetails) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/ramp/status?ref=${encodeURIComponent(bankDetails.merchantReference)}`);
        const j = await res.json();
        if (j.final) {
          clearInterval(id);
          if (j.status === 'completed') setStatusMsg({ ok: true, msg: `Credited! ${j.toAmount ?? ''} ${j.toCurrency?.toUpperCase()} added to your wallet.` });
          else setStatusMsg({ ok: false, msg: 'Deposit failed or refunded — check your transfer details.' });
        }
      } catch { /* keep polling */ }
    }, 8000);
    return () => clearInterval(id);
  }, [stage, bankDetails]);

  if (stage === 'awaiting' && bankDetails) {
    const rows = [
      ['Account Number', bankDetails.accountNumber],
      ['Bank', bankDetails.bankName],
      ['Account Name', bankDetails.accountName],
      ['Amount to send', `₦${bankDetails.amountExpected.toLocaleString()}`],
    ] as const;
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
          {rows.map(([k, v], i) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{k}</span>
              <span className="flex items-center gap-1.5 font-mono font-semibold text-sm">
                {v}
                <button onClick={() => { navigator.clipboard.writeText(v); setCopiedIdx(i); setTimeout(() => setCopiedIdx(-1), 1200); }}>
                  {copiedIdx === i ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3 w-3 opacity-60 hover:opacity-100" />}
                </button>
              </span>
            </div>
          ))}
        </div>

        <Alert variant="warning">
          Send <b>exactly ₦{bankDetails.amountExpected.toLocaleString()}</b> from an account matching your KLASSIQ name.
          Under/over payments are rejected &amp; refunded by the provider.
        </Alert>

        {statusMsg && <Feedback ok={!!statusMsg.ok} msg={statusMsg.msg} />}

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Waiting for your transfer… (checks every 8s)
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs text-muted-foreground">You pay</span>
        <div className="relative">
          <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="20000"
            className="pr-12 font-mono tabular-nums" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold">₦</span>
        </div>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs text-muted-foreground">Receive as</span>
        <Select value={toCoin} onChange={e => setToCoin(e.target.value)}>
          {CASH_COINS.map(c => <SelectOption key={c.value} value={c.value}>{c.label}</SelectOption>)}
        </Select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs text-muted-foreground">Network <span className="opacity-60">(optional)</span></span>
        <Input value={network} onChange={e => setNetwork(e.target.value)}
          placeholder={defaultNetwork(toCoin)} className="font-mono text-xs" />
      </label>

      {amt > 0 && (
        <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
          <Row k="You send" v={`₦${amt.toLocaleString()}`} />
          <Row k="Provider fee + VAT" v="shown at next step" muted />
          <Row k="You receive ≈" v={`${(netEstimate(amt)).toFixed(2)} ${toCoin.toUpperCase()}*`} />
        </div>
      )}

      {statusMsg && !statusMsg.ok && <Feedback ok={false} msg={statusMsg.msg} />}

      <Button className="w-full h-11 font-semibold" onClick={start} loading={submitting} disabled={amt <= 0}>
        Continue → Get Account Details
      </Button>
      <p className="text-[10px] text-center text-muted-foreground">
        A one-time virtual account is generated for this exact amount.
      </p>
    </div>
  );

  function netEstimate(a: number): number {
    // rough: assume ~1.5% total spread+fee before provider fees shown at confirm
    const rateGuess = toCoin === 'btc' ? 107_000_000 : toCoin === 'eth' ? 3_360_000 : toCoin === 'usdc' ? 1390 : 1391;
    return (a * 0.985) / rateGuess;
  }
}

/* ───────────── WITHDRAW · CRYPTO ───────────── */

function WithdrawCrypto({ wallets }: Props) {
  const funded = wallets.filter(w => w.balance > 0);
  const [currency, setCurrency] = useState(funded[0]?.currency ?? '');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; m: string } | null>(null);

  const sel = funded.find(w => w.currency === currency);
  const amt = parseFloat(amount) || 0;

  const go = async () => {
    setMsg(null);
    if (!address || address.length < 10) return setMsg({ ok: false, m: 'Enter destination address' });
    if (sel && amt > sel.balance) return setMsg({ ok: false, m: `Max: ${sel.balance}` });
    if (!confirm(`Send ${amt} ${currency.toUpperCase()}?\n\nTo: ${address}${network ? `\nNetwork: ${network}` : ''}`)) return;

    setBusy(true);
    try {
      const res = await fetch('/api/wallets/withdraw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'crypto', currency, amount: amt, address, ...(network && { network }) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setMsg({ ok: true, m: 'Submitted! Tracking under Transactions.' });
    } catch (e) {
      setMsg({ ok: false, m: e instanceof Error ? e.message : 'Failed' });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs text-muted-foreground">Coin</span>
        <Select value={currency} onChange={e => setCurrency(e.target.value)}>
          {(funded.length ? funded : [{ currency: '', balance: 0 }]).map(w => (
            <SelectOption key={w.currency} value={w.currency}>
              {w.currency ? `${w.currency.toUpperCase()} — ${w.balance}` : 'No funded coins yet'}
            </SelectOption>
          ))}
        </Select>
      </label>
      <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Destination Address</span>
        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Paste wallet address" className="font-mono text-xs" />
      </label>
      <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Network (optional)</span>
        <Input value={network} onChange={e => setNetwork(e.target.value)} placeholder="trc20 / bep20 / bitcoin…" className="font-mono text-xs" />
      </label>
      <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Amount</span>
        <div className="flex gap-2">
          <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="font-mono tabular-nums" />
          <Button variant="outline" size="sm" type="button" onClick={() => setAmount(String(sel?.balance ?? ''))}>Max</Button>
        </div>
      </label>
      {msg && <Feedback ok={msg.ok} msg={msg.m} />}
      <Button className={cn('w-full h-10 text-white', (!funded.length || amt <= 0) && 'cursor-not-allowed bg-zinc-700')}
        disabled={!funded.length || amt <= 0 || busy} onClick={go}>
        {busy ? 'Submitting…' : `Withdraw ${currency ? currency.toUpperCase() : ''}`}
      </Button>
      {!funded.length && <p className="text-xs text-center text-muted-foreground">Fund a wallet first.</p>}
    </div>
  );
}

/* ───────────── WITHDRAW · CASH ───────────── */

function WithdrawCash({ onChanged }: Props) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccs, setLoadingAccs] = useState(true);
  const [accountId, setAccountId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [nBank, setNBank] = useState('');
  const [nAcct, setNAcct] = useState('');
  const [resolved, setResolved] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [savingAcct, setSavingAcct] = useState(false);
  const [amount, setAmount] = useState('');
  const amt = parseFloat(amount) || 0;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; m: string } | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoadingAccs(true);
    try {
      const r = await fetch('/api/banks/my-accounts');
      if (r.ok) { const l = await r.json(); setAccounts(l); const d = l.find((a: any) => a.isDefault) ?? l[0]; if (d) setAccountId(d.id); }
    } finally { setLoadingAccs(false); }
  }, []);
  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  // Load bank directory once
  useEffect(() => {
    fetch('/api/banks').then(r => r.json()).then(setBanks).catch(() => {});
  }, []);

  // Auto-resolve when 10 digits entered
  useEffect(() => {
    if (!/^\d{10}$/.test(nAcct) || !nBank) { setResolved(null); return; }
    const t = setTimeout(async () => {
      setResolving(true);
      try {
        const r = await fetch('/api/banks/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountNumber: nAcct, bankCode: nBank }) });
        const j = await r.json();
        setResolved(j.available ? j.accountName : null);
      } catch { setResolved(null); }
      finally { setResolving(false); }
    }, 600);
    return () => clearTimeout(t);
  }, [nAcct, nBank]);

  const saveAndUse = async () => {
    if (!nBank || !/^\d{10}$/.test(nAcct)) return;
    setSavingAcct(true);
    try {
      const bankName = banks.find(b => b.code === nBank)?.name ?? nBank;
      const res = await fetch('/api/banks/my-accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankCode: nBank, accountNumber: nAcct, accountName: resolved || 'My Account' }),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error || 'Save failed');
      await loadAccounts();
      setAccountId(saved.id);
      setShowAdd(false);
    } catch (e) {
      setMsg({ ok: false, m: e instanceof Error ? e.message : 'Save failed' });
    } finally { setSavingAcct(false); }
  };

  const submit = async () => {
    const amt = parseFloat(amount) || 0;
    if (!accountId) return setMsg({ ok: false, m: 'Select a bank account' });
    if (amt <= 0) return setMsg({ ok: false, m: 'Enter an amount' });
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/wallets/withdraw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ngn', amount: amt, bankAccountId: accountId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setMsg({ ok: true, m: `₦${amt.toLocaleString()} on its way!` });
      setTimeout(() => { onChanged(); }, 1500);
    } catch (e) {
      setMsg({ ok: false, m: e instanceof Error ? e.message : 'Failed' });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* Saved accounts OR inline add */}
      {accounts.length > 0 && !showAdd ? (
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">Pay into</span>
          <Select value={accountId} onChange={e => setAccountId(e.target.value)}>
            {accounts.map(a => <SelectOption key={a.id} value={a.id}>{a.bankName} • ••••{a.accountNumber.slice(-4)}</SelectOption>)}
          </Select>
          <button onClick={() => setShowAdd(true)} className="text-[11px] text-primary hover:underline">+ Use another account</button>
        </label>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{accounts.length ? 'New account' : 'Link your first account'}</span>
            {accounts.length > 0 && (
              <button onClick={() => setShowAdd(false)} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
            )}
          </div>
          <Select value={nBank} onChange={e => { setNBank(e.target.value); setResolved(null); }}>
            <SelectOption value="">— select bank —</SelectOption>
            {banks.map(b => <SelectOption key={b.code} value={b.code}>{b.name}</SelectOption>)}
          </Select>
          <Input value={nAcct} onChange={e => { const v = e.target.value.replace(/\\D/g, '').slice(0, 10); setNAcct(v); setResolved(null); }}
            placeholder="10-digit account number" className="font-mono tabular-nums" maxLength={10} />
          {(/^\d{10}$/.test(nAcct)) && (
            resolving ? <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> verifying name…</p>
              : resolved !== null ? <p className={cn('text-xs font-medium', resolved ? 'text-emerald-400' : 'text-red-400')}>{resolved ? `✓ ${resolved}` : '✗ Account not found — check details'}</p> : null
          )}
          <Button size="sm" variant="outline" className="w-full" disabled={!nBank || nAcct.length !== 10 || savingAcct}
            onClick={saveAndUse} loading={savingAcct}>Save &amp; use this account</Button>
        </div>
      )}

      <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Amount (₦)</span>
        <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10000" className="font-mono tabular-nums" />
      </label>

      {msg && <Feedback ok={msg.ok} msg={msg.m} />}

      <Button className="w-full h-10" onClick={submit} disabled={busy || !accountId || amt <= 0} loading={busy}>
        Withdraw ₦{amt > 0 ? amt.toLocaleString() : ''}
      </Button>
    </div>
  );
}

/* ───────────── shared bits ───────────── */

function CoinPicker({ coins, coin, onChange }: { coins: string[]; coin: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {coins.map(c => (
        <button key={c} onClick={() => onChange(c)}
          className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
            coin === c ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent')}>
          {c.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function CenterSpin() { return <div className="py-10 flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>; }
function EmptyState({ text }: { text: string }) { return <div className="py-6 text-center text-sm text-muted-foreground">{text}</div>; }
function InfoNote({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 p-3 rounded-lg bg-blue-500/10 text-blue-300 text-xs"><Info className="h-4 w-4 shrink-0 mt-0.5" /><p>{children}</p></div>;
}
function Feedback({ ok, msg }: { ok: boolean; msg: string }) {
  return <div className={cn('p-2.5 rounded-lg text-xs', ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>{msg}</div>;
}
function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className={cn('font-mono tabular-nums', muted && 'text-muted-foreground italic')}>{v}</span></div>;
}

function useMemoCoinList(wallets: { currency: string; balance: number }[]): string[] {
  const base = ['btc', 'usdt', 'eth'];
  const extra = wallets.filter(w => w.balance > 0 && !base.includes(w.currency)).map(w => w.currency);
  return [...new Set([...base, ...extra])];
}

function defaultNetwork(coin: string): string {
  switch (coin) {
    case 'btc': return 'bitcoin';
    case 'usdt': return 'trc20';
    case 'usdc': return 'bep20';
    default: return '';
  }
}

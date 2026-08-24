'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import { Alert, AlertDescription, AlertTitle } from '@klassiq-transakt/ui/components/Alert';
import { cn, formatNgn } from '@klassiq-transakt/ui/lib/utils';
import { Zap, RefreshCw, Info, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import MoneyModal from '@/components/terminal/wallets/MoneyModal';

interface WalletRow {
  currency: string;
  balance: number;
  locked: number;
  staked?: number;
  isCrypto: boolean;
  convertedNgn: number;
}

export default function WalletsPage() {
  const { data: session } = useSession();
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [totalNgn, setTotalNgn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [money, setMoney] = useState<{ intent: 'deposit' | 'withdraw' } | null>(null);

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

  const displayRows = useMemo(() => {
    const CORE = ['btc', 'usdt', 'eth'];
    const map = new Map<string, WalletRow>();
    CORE.forEach(c => map.set(c, { currency: c, balance: 0, locked: 0, isCrypto: true, convertedNgn: 0 }));
    wallets.forEach(w => { map.set(w.currency, w); });
    return [...map.values()].sort((a, b) => (b.convertedNgn - a.convertedNgn) || (b.balance - a.balance));
  }, [wallets]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top row: balance + actions grouped left, white/blue accent */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 rounded-xl border border-blue-100 bg-white p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Estimated Total Value</p>
            <p className="text-3xl font-bold font-mono tabular-nums mt-1 text-slate-900">{formatNgn(totalNgn)}</p>
            <p className="text-xs text-slate-500 mt-1">Wallets · valued in NGN</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={load} className="p-2.5 rounded-lg border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100" title="Refresh">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <Button onClick={() => setMoney({ intent: 'deposit' })} size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 text-white">
              <ArrowDownToLine className="h-4 w-4 mr-1.5" /> Deposit
            </Button>
            <Button onClick={() => setMoney({ intent: 'withdraw' })} variant="outline" size="sm" className="h-9 border-blue-200 text-blue-700 hover:bg-blue-50">
              <ArrowUpFromLine className="h-4 w-4 mr-1.5" /> Withdraw
            </Button>
          </div>
        </div>
        <div className="w-full lg:w-[340px] shrink-0 rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-slate-900">Auto-Offramp Engine</p>
            <Badge variant="success" className="ml-auto">ACTIVE</Badge>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Any BTC deposited to your addresses is automatically sold at market and paid out to your default bank account.
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
            ) : displayRows.map(w => (
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
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMoney({ intent: 'deposit' })}>
                      <ArrowDownToLine className="h-3 w-3 mr-1" /> Deposit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={w.balance <= 0}
                      onClick={() => setMoney({ intent: 'withdraw' })}>
                      <ArrowUpFromLine className="h-3 w-3 mr-1" /> Withdraw
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {money && (
        <MoneyModal
          intent={money.intent}
          wallets={wallets}
          userEmail={session?.user?.email ?? null}
          userName={session?.user?.name ?? null}
          onClose={() => setMoney(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

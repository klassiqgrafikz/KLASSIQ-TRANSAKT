'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Alert, AlertDescription, AlertTitle } from '@klassiq-transakt/ui/components/Alert';
import { cn, formatNgn } from '@klassiq-transakt/ui/lib/utils';
import { RefreshCw, Info } from 'lucide-react';
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
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Simple header — no hero, just title + refresh */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Wallets</h1>
        <button onClick={load} className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50" title="Refresh balances">
          <RefreshCw className={cn('h-4 w-4 text-zinc-600', loading && 'animate-spin')} />
        </button>
      </div>

      {error && (
        <Alert variant="destructive">
          <Info />
          <AlertTitle>Couldn't load wallets</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 font-medium">Currency</th>
              <th className="px-4 py-3 text-right font-medium">Available</th>
              <th className="px-4 py-3 text-right font-medium">Est. Value</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && wallets.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="h-4 animate-pulse rounded bg-zinc-100" /></td>
                  ))}
                </tr>
              ))
            ) : displayRows.map(w => (
              <tr key={w.currency} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-full bg-violet-50 text-violet-600 grid place-items-center text-[10px] font-bold uppercase border border-violet-100">
                      {w.currency.slice(0, 3)}
                    </span>
                    <span className="font-semibold uppercase text-zinc-900">{w.currency}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-700">
                  {w.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-600">
                  {w.convertedNgn > 0 ? formatNgn(w.convertedNgn) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setMoney({ intent: 'deposit' })}
                      className="text-xs font-medium text-violet-600 hover:text-violet-700 hover:underline px-2 py-1">
                      Deposit
                    </button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs hover:bg-zinc-100" disabled={w.balance <= 0}
                      onClick={() => setMoney({ intent: 'withdraw' })}>
                      Withdraw
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

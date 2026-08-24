'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { formatNgn } from '@klassiq-transakt/ui/lib/utils';
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import NetworkView from '@/components/terminal/NetworkView';
import MoneyModal from '@/components/terminal/wallets/MoneyModal';

interface WalletRow {
  currency: string;
  balance: number;
  locked: number;
  isCrypto: boolean;
  convertedNgn: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [totalNgn, setTotalNgn] = useState(0);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [money, setMoney] = useState<{ intent: 'deposit' | 'withdraw' } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/wallets');
      const json = await res.json();
      if (res.ok) {
        setWallets(json.wallets ?? []);
        setTotalNgn(json.totalNgn ?? 0);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-zinc-500">Your balances and market overview</p>
      </div>

      {/* Hero: balance + actions LEFT, network RIGHT */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left — Estimated Total Value + Actions */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 md:p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-100 text-violet-600 grid place-items-center shrink-0">
              <WalletIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-zinc-500 font-medium">Estimated Total Value</p>
              {loading ? (
                <div className="h-9 w-40 mt-1 animate-pulse rounded bg-zinc-100" />
              ) : (
                <p className="text-2xl md:text-3xl font-bold font-mono tabular-nums mt-0.5">{formatNgn(totalNgn)}</p>
              )}
              <p className="text-xs text-zinc-500 mt-1">
                Balances valued in NGN · <span className="inline-flex items-center gap-1 font-medium text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Auto-Offramp ACTIVE</span>
              </p>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={() => setMoney({ intent: 'deposit' })} size="sm" className="flex-1 h-10 bg-violet-600 hover:bg-violet-700">
              <ArrowDownToLine className="h-4 w-4 mr-1.5" /> Deposit
            </Button>
            <Button onClick={() => setMoney({ intent: 'withdraw' })} variant="outline" size="sm" className="flex-1 h-10 border-zinc-300">
              <ArrowUpFromLine className="h-4 w-4 mr-1.5" /> Withdraw
            </Button>
          </div>
        </div>

        {/* Right — Network Prices rotating */}
        <NetworkView />
      </div>

      {/* Quick wallets preview */}
      {!loading && wallets.filter(w => w.balance > 0).length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Top Holdings</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {wallets.filter(w => w.balance > 0).slice(0, 3).map(w => (
              <div key={w.currency} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                <span className="text-xs font-bold uppercase">{w.currency}</span>
                <span className="font-mono text-sm">{w.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { UserOrder } from '@klassiq-transakt/exchange';
import { cn } from '@klassiq-transakt/ui/lib/utils';

interface Props {
  market: string;
  refreshKey: number; // bump after placing an order
}

type Tab = 'open' | 'history';

export default function OrdersPanel({ market, refreshKey }: Props) {
  const [tab, setTab] = useState<Tab>('open');
  const [open, setOpen] = useState<UserOrder[]>([]);
  const [history, setHistory] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trade/orders?market=${market}`);
      if (!res.ok) return;
      const json = await res.json();
      setOpen(json.open ?? []);
      setHistory(json.history ?? []);
    } catch { /* keep stale */ }
    finally { setLoading(false); }
  }, [market]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const cancel = async (id: string) => {
    setCancellingId(id);
    try {
      const res = await fetch(`/api/trade/orders/${id}`, { method: 'DELETE' });
      if (res.ok || res.status === 400) load(); // even if already filled/cancelled
    } finally {
      setCancellingId(null);
    }
  };

  const rows = tab === 'open' ? open : history;

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-4 px-3 pt-2.5 pb-2 border-b border-border text-xs">
        {(['open', 'history'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'capitalize pb-2 -mb-px font-medium',
              tab === t ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'open' ? `Open Orders${open.length ? ` (${open.length})` : ''}` : 'Order History'}
          </button>
        ))}
        <span className="ml-auto flex items-center text-[10px] text-muted-foreground">
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {!loading && rows.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            {tab === 'open' ? 'No open orders.' : 'No order history yet.'}
          </div>
        ) : (
          <table className="w-full text-xs font-mono tabular-nums">
            <thead className="sticky top-0 bg-card">
              <tr className="text-muted-foreground text-left border-b border-border">
                <th className="px-3 py-1.5">Time</th>
                <th className="px-3 py-1.5">Side</th>
                <th className="px-3 py-1.5">Type</th>
                <th className="px-3 py-1.5 text-right">Price</th>
                <th className="px-3 py-1.5 text-right">Filled / Total</th>
                <th className="px-3 py-1.5">State</th>
                <th className="px-3 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(o => (
                <tr key={o.id} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {new Date(o.createdAt).toLocaleTimeString()}
                  </td>
                  <td className={cn('px-3 py-1.5', o.side === 'buy' ? 'up' : 'down')}>
                    {o.side}
                  </td>
                  <td className="px-3 py-1.5 capitalize">{o.type}</td>
                  <td className="px-3 py-1.5 text-right">{fmtN(o.type === 'limit' ? o.price : o.avgPrice)}</td>
                  <td className="px-3 py-1.5 text-right">
                    {fmtN(o.executedVolume)} / {fmtN(o.originVolume)}
                  </td>
                  <td className={cn('px-3 py-1.5', stateClass(o.state))}>{o.state}</td>
                  <td className="px-3 py-1.5 text-right">
                    {tab === 'open' && (
                      <button
                        onClick={() => cancel(o.id)}
                        disabled={cancellingId === o.id}
                        title="Cancel order"
                        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-red-400"
                      >
                        {cancellingId === o.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <X className="h-3 w-3" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function fmtN(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: n >= 100 ? 2 : 8 });
}

function stateClass(state: string): string {
  const s = state.toLowerCase();
  if (['done', 'filled', 'completed'].includes(s)) return 'up';
  if (['cancel', 'cancelled', 'rejected', 'reject', 'failed'].includes(s)) return 'down';
  return 'text-yellow-400'; // wait/pending/partially
}
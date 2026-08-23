'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { MarketTicker } from '@klassiq-transakt/exchange';
import { cn } from '@klassiq-transakt/ui/lib/utils';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Star, Search, RefreshCw } from 'lucide-react';

type Tab = 'ngn' | 'usdt' | 'fav';

const WATCHLIST_KEY = 'kt-watchlist';
const fetchTickersRef: { current?: () => void } = {};

export default function MarketsPage() {
  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('ngn');
  const [search, setSearch] = useState('');
  const [favs, setFavs] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number>(0);

  // Watchlist persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (raw) setFavs(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const toggleFav = (market: string) => {
    setFavs(prev => {
      const next = prev.includes(market) ? prev.filter(m => m !== market) : [...prev, market];
      try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Poll feed every 5s
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch('/api/markets/tickers');
        if (!res.ok) return;
        const json = await res.json();
        if (alive && Array.isArray(json.tickers)) {
          setTickers(json.tickers);
          setUpdatedAt(Date.now());
        }
      } catch { /* keep stale */ }
      finally { if (alive) setLoading(false); }
    };

    // expose for manual refresh button
    fetchTickersRef.current = load;

    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  function fetchTickers() {
    fetchTickersRef.current?.();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickers
      .filter(t => {
        if (tab === 'ngn') return t.market.endsWith('ngn') && t.market !== 'cngnngn';
        if (tab === 'usdt') return t.market.endsWith('usdt');
        return favs.includes(t.market); // fav shows across any quote
      })
      .filter(t =>
        !q ||
        t.market.toLowerCase().includes(q) ||
        t.base.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const fa = favs.includes(a.market) ? 1 : 0;
        const fb = favs.includes(b.market) ? 1 : 0;
        if (fa !== fb) return fb - fa;
        return Math.abs(b.changePct) - Math.abs(a.changePct);
      });
  }, [tickers, tab, search, favs]);

  const fmtPrice = (n: number) =>
    '₦' + n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 4 : 0 });

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-lg font-bold mr-auto">Markets</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search markets…"
            className="pl-9 h-9 bg-card"
          />
        </div>
        <button
          onClick={() => { setLoading(true); fetchTickers(); }}
          title={updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : ''}
          className="p-2 rounded-lg border border-border hover:bg-accent"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {([
          ['ngn', `NGN Pairs`],
          ['usdt', 'USDT Majors'],
          ['fav', `Favourites${favs.length ? ` (${favs.length})` : ''}`],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3 text-right">Last Price</th>
                <th className="px-4 py-3 text-right">24h Change</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">24h High</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">24h Low</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Volume</th>
                <th className="px-4 py-3 text-right">Trade</th>
              </tr>
            </thead>
            <tbody>
              {loading && tickers.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {tab === 'fav' && favs.length === 0
                      ? 'No favourites yet — tap the ☆ on any market to build your watchlist.'
                      : 'No markets match your search.'}
                  </td>
                </tr>
              ) : (
                filtered.map(t => {
                  const up = t.changePct >= 0;
                  return (
                    <tr key={t.market} className="border-b border-border/50 hover:bg-accent/40 transition-colors group">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleFav(t.market)}
                          aria-label={favs.includes(t.market) ? 'Remove from favourites' : 'Add to favourites'}
                        >
                          <Star
                            className={cn(
                              'h-4 w-4 transition-colors',
                              favs.includes(t.market)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground/40 hover:text-yellow-400'
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/trade/${t.market}`} className="flex items-center gap-2 hover:text-primary">
                          <span className="font-semibold uppercase">{t.base}</span>
                          <span className="text-muted-foreground/60 text-xs">/ {t.quote.toUpperCase()}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-medium">
                        {t.quote === 'ngn' ? fmtPrice(t.last) : t.last.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      </td>
                      <td className={cn('px-4 py-3 text-right font-mono tabular-nums', up ? 'up' : 'down')}>
                        {up ? '+' : ''}{t.changePct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground hidden md:table-cell">
                        {t.high.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground hidden md:table-cell">
                        {t.low.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground hidden lg:table-cell">
                        {t.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })} {t.base.toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/trade/${t.market}`}
                          className="inline-block rounded-md bg-primary/15 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/25"
                        >
                          Trade
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground text-right">
        Live from Quidax · auto-refreshes every 5s{updatedAt ? ` · last ${new Date(updatedAt).toLocaleTimeString()}` : ''}
      </p>
    </div>
  );
}
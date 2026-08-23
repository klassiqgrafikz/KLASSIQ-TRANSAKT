'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import CandleChart from '@/components/terminal/trade/CandleChart';
import OrderBook from '@/components/terminal/trade/OrderBook';
import TradeForm from '@/components/terminal/trade/TradeForm';
import OrdersPanel from '@/components/terminal/trade/OrdersPanel';
import type { MarketTicker } from '@klassiq-transakt/exchange';
import { cn } from '@klassiq-transakt/ui/lib/utils';
import { Search, ChevronDown } from 'lucide-react';

export default function SpotTerminalPage() {
  const params = useParams<{ market: string }>();
  const market = (params?.market ?? 'btcngn').toLowerCase();

  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [allTickers, setAllTickers] = useState<MarketTicker[]>([]);
  const [period, setPeriod] = useState<number>(15);
  const [formPrice, setFormPrice] = useState<number | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const base = market.replace(/(ngn|usdt|ghs|usd|xaf|xof|zar|kes)$/i, '');
  const quoteMatch = market.match(/(ngn|usdt|ghs|usd|xaf|xof|zar|kes)$/i);
  const quote = quoteMatch ? quoteMatch[0] : '';

  // Poll ticker for header + strip data
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch('/api/markets/tickers');
        if (!res.ok || !alive) return;
        const json = await res.json();
        if (!alive || !Array.isArray(json.tickers)) return;
        setAllTickers(json.tickers);
        setTicker(json.tickers.find((t: MarketTicker) => t.market === market) ?? null);
      } catch { /* keep stale */ }
    };

    load();
    const id = setInterval(load, 3000);
    return () => { alive = false; clearInterval(id); };
  }, [market]);

  const up = (ticker?.changePct ?? 0) >= 0;

  const groupedPairs = useMemo(() => {
    const ngn = allTickers.filter(t => t.quote === 'ngn');
    const usdt = allTickers.filter(t => t.quote === 'usdt').slice(0, 40);
    return { NGN: ngn, USDT: usdt };
  }, [allTickers]);

  return (
    <div className="flex flex-col gap-px bg-border min-h-screen">
      {/* ── Pair header bar ───────────────────────────── */}
      <div className="bg-card flex items-center flex-wrap gap-x-6 gap-y-2 px-3 py-2.5">
        {/* Pair selector */}
        <div className="group relative">
          <button className="flex items-center gap-1.5 font-bold text-base hover:text-primary transition-colors">
            <span className="uppercase">{base}</span>
            <span className="text-muted-foreground font-normal text-xs">/{quote.toUpperCase()}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </button>

          <div className="hidden group-hover:block absolute z-50 left-0 top-full mt-1 w-72 rounded-lg border border-border bg-popover shadow-xl">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  placeholder="Search pair…"
                  onChange={e => {
                    const q = e.target.value.toLowerCase();
                    document.querySelectorAll<HTMLDivElement>('[data-pair-row]').forEach(el => {
                      el.style.display = el.textContent!.toLowerCase().includes(q) ? '' : 'none';
                    });
                  }}
                  className="w-full h-8 rounded-md bg-muted pl-8 pr-2 text-sm outline-none"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {Object.entries(groupedPairs).map(([label, list]) => (
                <div key={label}>
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/50 sticky top-0">
                    {label} markets
                  </div>
                  {list.map(t => (
                    <a
                      key={t.market}
                      href={`/trade/${t.market}`}
                      data-pair-row
                      className={cn(
                        'flex items-center justify-between px-3 py-1.5 text-xs hover:bg-accent',
                        t.market === market && 'text-primary'
                      )}
                    >
                      <span className="uppercase font-medium">{t.base}/{t.quote}</span>
                      <span className="font-mono tabular-nums">{fmtNum(t.last)}</span>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Last price */}
        <div className="flex items-baseline gap-2">
          <span className={cn('text-xl font-bold font-mono tabular-nums', up ? 'up' : 'down')}>
            {ticker ? fmtNum(ticker.last) : '—'}
          </span>
          <span className={cn('text-xs font-medium', up ? 'up' : 'down')}>
            {up ? '▲' : '▼'} {Math.abs(ticker?.changePct ?? 0).toFixed(2)}%
          </span>
        </div>

        {/* 24h stats */}
        <Stat label="24h High" value={ticker ? fmtNum(ticker.high) : '—'} />
        <Stat label="24h Low" value={ticker ? fmtNum(ticker.low) : '—'} />
        <Stat label={`24h Vol (${base.toUpperCase()})`} value={ticker ? ticker.volume.toFixed(4) : '—'} />
      </div>

      {/* ── Main grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_280px_300px] gap-px flex-1">
        {/* Chart column */}
        <div className="bg-card flex flex-col min-h-[420px]">
          <CandleChart
            market={market}
            period={period}
            onPeriodChange={setPeriod}
            lastPrice={ticker?.last}
          />
        </div>

        {/* Order book */}
        <div className="bg-card order-2 lg:order-none min-h-[380px]">
          <OrderBook
            market={market}
            onPriceClick={p => setFormPrice(p)}
          />
        </div>

        {/* Trade form */}
        <div className="bg-card order-3 lg:order-none lg:row-span-2">
          <TradeForm
            key={market}
            market={market}
            base={base}
            quote={quote}
            quotePrice={formPrice ?? ticker?.last}
            onOrderPlaced={() => setRefreshKey(k => k + 1)}
          />
        </div>

        {/* Orders panel — spans under chart */}
        <div className="bg-card order-4 h-[240px]">
          <OrdersPanel market={market} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden sm:block">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-mono tabular-nums">{value}</div>
    </div>
  );
}

function fmtNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: n >= 100 ? 0 : n >= 1 ? 2 : 8 });
}
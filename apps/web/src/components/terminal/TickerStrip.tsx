'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MarketTicker } from '@klassiq-transakt/exchange';

const MAJORS = ['btcngn', 'usdtngn', 'ethngn', 'solngn', 'xrpngn', 'ltcngn', 'usdcngn', 'xautngn'];

export default function TickerStrip() {
  const [tickers, setTickers] = useState<MarketTicker[]>([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch('/api/markets/tickers');
        if (!res.ok) return;
        const json = await res.json();
        if (alive && Array.isArray(json.tickers)) {
          const majors = MAJORS
            .map((m) => json.tickers.find((t: MarketTicker) => t.market === m))
            .filter(Boolean);
          setTickers(majors.length ? majors : json.tickers.slice(0, 8));
        }
      } catch {
        /* silent — strip just stays stale */
      }
    };

    load();
    const id = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (tickers.length === 0) {
    return <div className="h-6 flex-1 animate-pulse rounded bg-muted/60 mx-2" />;
  }

  return (
    <div className="flex-1 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-5 px-2 min-w-max">
        {tickers.map((t) => (
          <Link
            key={t.market}
            href={`/trade/${t.market}`}
            className="flex items-center gap-1.5 text-xs whitespace-nowrap hover:opacity-80"
          >
            <span className="font-semibold uppercase">{t.base}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              ₦{t.last.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className={cnChange(t.changePct)}>
              {t.changePct >= 0 ? '▲' : '▼'} {Math.abs(t.changePct).toFixed(2)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function cnChange(pct: number) {
  return pct >= 0 ? 'text-emerald-400' : 'text-red-400';
}
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
    return <div className="h-6 w-[360px] lg:w-[440px] animate-pulse rounded bg-white/10 mx-2 hidden md:block" />;
  }

  const loop = [...tickers, ...tickers];

  return (
    <div className="hidden md:flex w-[360px] lg:w-[440px] overflow-hidden rounded-full bg-white border border-blue-100 shadow-sm shrink-0">
      <div className="flex animate-marquee whitespace-nowrap will-change-transform">
        {loop.map((t, i) => (
          <Link
            key={`${t.market}-${i}`}
            href={`/trade/${t.market}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap hover:bg-blue-50"
          >
            <span className="font-bold uppercase text-slate-900">{t.base}</span>
            <span className="font-mono tabular-nums text-slate-600">
              ₦{t.last.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className={t.changePct >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              {t.changePct >= 0 ? '▲' : '▼'} {Math.abs(t.changePct).toFixed(2)}%
            </span>
            <span className="text-slate-300 mx-1">•</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function cnChange(pct: number) {
  return pct >= 0 ? 'text-emerald-400' : 'text-red-400';
}
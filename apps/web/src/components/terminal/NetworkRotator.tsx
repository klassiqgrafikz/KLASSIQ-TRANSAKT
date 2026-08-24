'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MarketTicker } from '@klassiq-transakt/exchange';

const MAJORS = ['btcngn', 'usdtngn', 'ethngn', 'solngn', 'xrpngn', 'ltcngn', 'usdcngn', 'xautngn'];

export default function NetworkRotator() {
  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [idx, setIdx] = useState(0);

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
            .filter(Boolean) as MarketTicker[];
          setTickers(majors.length ? majors : json.tickers.slice(0, 8));
        }
      } catch {}
    };
    load();
    const id = setInterval(load, 10000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (tickers.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % tickers.length), 3000);
    return () => clearInterval(id);
  }, [tickers.length]);

  if (tickers.length === 0) {
    return <div className="h-7 w-40 animate-pulse rounded bg-zinc-100" />;
  }

  const t = tickers[idx];
  if (!t) return null;
  const up = t.changePct >= 0;

  return (
    <Link
      href={`/trade/${t.market}`}
      className="group relative flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 hover:bg-white hover:shadow-sm transition-all"
      title={`High ₦${t.high.toLocaleString()} · Low ₦${t.low.toLocaleString()} · Vol ${t.volume.toLocaleString()} ${t.base.toUpperCase()}`}
    >
      <span className="text-xs font-bold uppercase tracking-wide">{t.base}</span>
      <span className="font-mono text-xs tabular-nums">₦{t.last.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      <span className={`text-[11px] font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
        {up ? '▲' : '▼'} {Math.abs(t.changePct).toFixed(2)}%
      </span>
      <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      {/* Hover tooltip */}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg group-hover:block">
        <span className="text-zinc-500">High</span> ₦{t.high.toLocaleString()} ·{' '}
        <span className="text-zinc-500">Low</span> ₦{t.low.toLocaleString()} ·{' '}
        <span className="text-zinc-500">Vol</span> {t.volume.toLocaleString()} {t.base.toUpperCase()}
      </span>
    </Link>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MarketTicker } from '@klassiq-transakt/exchange';

const MAJORS = ['btcngn', 'usdtngn', 'ethngn', 'solngn', 'xrpngn', 'ltcngn', 'usdcngn', 'xautngn'];

export default function NetworkView() {
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
    const id = setInterval(() => setIdx((i) => (i + 1) % tickers.length), 3500);
    return () => clearInterval(id);
  }, [tickers.length]);

  if (tickers.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="h-20 animate-pulse rounded bg-zinc-100" />
      </div>
    );
  }

  const t = tickers[idx];
  if (!t) return null;
  const up = t.changePct >= 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-medium">Network Prices</span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      <Link href={`/trade/${t.market}`} className="block hover:opacity-80 transition-opacity">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold uppercase tracking-wide">{t.base} / {t.quote.toUpperCase()}</span>
          <span className={`text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
            {up ? '▲' : '▼'} {Math.abs(t.changePct).toFixed(2)}%
          </span>
        </div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
          ₦{t.last.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </Link>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-zinc-500">High</p>
          <p className="font-mono font-medium">₦{t.high.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-zinc-500">Low</p>
          <p className="font-mono font-medium">₦{t.low.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-zinc-500">Vol</p>
          <p className="font-mono font-medium">{t.volume.toLocaleString()} {t.base.toUpperCase()}</p>
        </div>
      </div>

      <div className="mt-3 flex gap-1.5 justify-center">
        {tickers.map((_, i) => (
          <span key={i} className={`h-1 rounded-full transition-all ${i === idx ? 'w-6 bg-violet-600' : 'w-1 bg-zinc-200'}`} />
        ))}
      </div>
    </div>
  );
}

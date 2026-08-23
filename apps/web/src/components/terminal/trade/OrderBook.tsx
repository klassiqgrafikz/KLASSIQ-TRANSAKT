'use client';

import { useEffect, useState } from 'react';
import type { DepthSnapshot, DepthLevel } from '@klassiq-transakt/exchange';
import { cn } from '@klassiq-transakt/ui/lib/utils';

interface Props {
  market: string;
  onPriceClick: (price: number) => void;
}

export default function OrderBook({ market, onPriceClick }: Props) {
  const [depth, setDepth] = useState<DepthSnapshot | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch(`/api/markets/${market}/depth?limit=12`);
        if (!res.ok) return;
        const json = (await res.json()) as DepthSnapshot;
        if (alive) setDepth(json);
      } catch { /* keep stale */ }
    };

    load();
    const id = setInterval(load, 3000);
    return () => { alive = false; clearInterval(id); };
  }, [market]);

  const asks = (depth?.asks ?? []).slice(0, 10);           // lowest ask first
  const bids = (depth?.bids ?? []).slice(0, 10);           // highest bid first
  const bestAsk = asks[0]?.price ?? 0;
  const bestBid = bids[0]?.price ?? 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;

  const maxCum = Math.max(
    asks.reduce((s, l) => s + l.volume, 0),
    bids.reduce((s, l) => s + l.volume, 0),
    1e-12,
  );

  // Render asks reversed so lowest sits next to spread
  const askRows = [...asks].reverse();
  const cumAsk = runningTotal(asks.map(a => a.volume));
  const cumBid = runningTotal(bids.map(b => b.volume));

  return (
    <div className="flex flex-col text-xs font-mono tabular-nums h-full">
      <div className="px-3 py-2 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground flex justify-between">
        <span>Order Book</span>
        <span>Vol</span>
      </div>

      {/* Asks */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end py-1">
        {askRows.length === 0 && <div className="px-3 py-1.5 text-muted-foreground">—</div>}
        {askRows.map((l: DepthLevel) => {
          const i = asks.findIndex(x => x.price === l.price);
          const widthPct = ((cumAsk[i] ?? 0) / maxCum) * 100;
          return (
            <button
              key={`a-${l.price}`}
              onClick={() => onPriceClick(l.price)}
              className="relative flex items-center justify-between px-3 py-[3px] hover:bg-accent/50"
            >
              <span
                className="absolute inset-y-0 right-0 bg-red-500/10 group-hover:bg-red-500/20"
                style={{ width: `${widthPct}%` }}
              />
              <span className="relative text-red-400">{fmt(l.price)}</span>
              <span className="relative text-muted-foreground">{fmtVol(l.volume)}</span>
            </button>
          );
        })}
      </div>

      {/* Spread */}
      {spread > 0 && (
        <div className="px-3 py-1.5 border-y border-border bg-muted/30 flex items-center justify-between">
          <span className="text-sm font-bold">{fmt(mid(bestAsk, bestBid))}</span>
          <span className="text-[10px] text-muted-foreground">
            spread {fmt(spread)}
          </span>
        </div>
      )}

      {/* Bids */}
      <div className="flex-1 overflow-hidden py-1">
        {bids.length === 0 && <div className="px-3 py-1.5 text-muted-foreground">—</div>}
        {bids.map((l, i) => (
          <button
            key={`b-${l.price}`}
            onClick={() => onPriceClick(l.price)}
            className="relative w-full flex items-center justify-between px-3 py-[3px] hover:bg-accent/50"
          >
            <span
              className="absolute inset-y-0 right-0 bg-emerald-500/10"
              style={{ width: `${((cumBid[i] ?? 0) / maxCum) * 100}%` }}
            />
            <span className="relative text-emerald-400">{fmt(l.price)}</span>
            <span className="relative text-muted-foreground">{fmtVol(l.volume)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function runningTotal(vols: number[]): number[] {
  let sum = 0;
  return vols.map(v => (sum += v));
}

function mid(a: number, b: number) {
  return (a + b) / 2;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: n >= 1000 ? 0 : n >= 1 ? 2 : 6,
    maximumFractionDigits: n >= 1000 ? 0 : n >= 1 ? 2 : 6,
  });
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K';
  return n.toFixed(n >= 1 ? 4 : 8).replace(/0+$/, '').replace(/\.$/, '');
}
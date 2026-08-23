'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { Select, SelectOption } from '@klassiq-transakt/ui/components/Select';
import { Badge } from '@klassiq-transakt/ui/components/Badge';
import { cn, formatNgn } from '@klassiq-transakt/ui/lib/utils';
import {
  ArrowLeftRight, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import type { MarketTicker } from '@klassiq-transakt/exchange';

const COINS = ['btc', 'usdt', 'eth', 'sol', 'xrp', 'ltc', 'bch', 'trx'];

export default function ConvertPage() {
  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [fromCoin, setFromCoin] = useState('btc');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const availableCoins = useMemo(
    () => COINS.filter(c => tickers.some(t => t.market === `${c}ngn`)),
    [tickers],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/markets/tickers');
        if (res.ok) {
          const json = await res.json();
          setTickers(json.tickers ?? []);
        }
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const ticker = tickers.find(t => t.market === `${fromCoin}ngn`);
  const amt = parseFloat(amount) || 0;
  const gross = amt * (ticker?.last ?? 0);
  // ~0.1% taker fee model (matches Quidax spot); display as estimate
  const estFee = gross * 0.001;
  const net = Math.max(gross - estFee, 0);

  const submit = async () => {
    setFeedback(null);
    if (amt <= 0) return setFeedback({ ok: false, msg: 'Enter an amount' });

    setSubmitting(true);
    try {
      const res = await fetch('/api/trade/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market: `${fromCoin}ngn`,
          side: 'sell',
          type: 'market',
          volume: amt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Swap failed');
      setFeedback({ ok: true, msg: `Sold ${amt} ${fromCoin.toUpperCase()} for ≈${formatNgn(net)} NGN` });
      setAmount('');
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : 'Swap failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 md:p-6 grid place-items-center min-h-[80vh]">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <h1 className="text-lg font-bold flex items-center justify-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Instant Convert
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sell crypto at live market rates — NGN lands in your Quidax wallet instantly.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          {/* From */}
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">You sell</span>
            <div className="flex gap-2">
              <Select value={fromCoin} onChange={e => setFromCoin(e.target.value)} className="w-28">
                {availableCoins.map(c => (
                  <SelectOption key={c} value={c}>{c.toUpperCase()}</SelectOption>
                ))}
              </Select>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 font-mono tabular-nums"
              />
            </div>
          </label>

          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs px-1">
            <span className="text-muted-foreground">Rate</span>
            <span className="text-right font-mono tabular-nums">
              {ticker ? formatNgn(ticker.last) : '—'} / {fromCoin.toUpperCase()}
            </span>
            <span className="text-muted-foreground">Fee (≈0.1%)</span>
            <span className="text-right font-mono tabular-nums">{gross > 0 ? formatNgn(estFee) : '—'}</span>
          </div>

          {/* Receive preview */}
          <div className={cn('p-4 rounded-xl border text-center transition-colors',
            net > 0 ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border bg-muted/30')}>
            <p className="text-xs text-muted-foreground mb-1">You receive ≈</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
              {net > 0 ? formatNgn(net) : formatNgn(0)}
            </p>
          </div>

          {feedback && (
            <div className={cn(
              'flex items-start gap-2 p-2.5 rounded-lg text-xs',
              feedback.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            )}>
              {feedback.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{feedback.msg}</span>
            </div>
          )}

          <Button
            onClick={submit}
            disabled={submitting || amt <= 0 || !ticker}
            loading={submitting}
            className="w-full h-11 font-semibold"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Swap {fromCoin.toUpperCase()} → NGN
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Market order executes instantly ·{' '}
            <Link href="/trade/btcngn" className="underline hover:text-primary">
              want limit control? Use the terminal
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { Button } from '@klassiq-transakt/ui/components/Button';
import { Input } from '@klassiq-transakt/ui/components/Input';
import { cn } from '@klassiq-transakt/ui/lib/utils';
import { Loader2, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  market: string;
  base: string;
  quote: string;
  quotePrice?: number;      // current market/selected price
  onOrderPlaced: () => void;
}

type Side = 'buy' | 'sell';
type OrderType = 'limit' | 'market';

export default function TradeForm({ market, base, quote, quotePrice, onOrderPlaced }: Props) {
  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<OrderType>('limit');
  const [price, setPrice] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const effectivePrice =
    type === 'market'
      ? (quotePrice ?? 0)
      : parseFloat(price) || 0;
  const amountNum = parseFloat(amount) || 0;
  const total = effectivePrice * amountNum;

  const submit = async () => {
    setFeedback(null);

    if (amountNum <= 0) return setFeedback({ ok: false, msg: 'Enter an amount' });
    if (type === 'limit' && effectivePrice <= 0) return setFeedback({ ok: false, msg: 'Enter a price' });

    setSubmitting(true);
    try {
      const res = await fetch('/api/trade/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market,
          side,
          type,
          volume: amountNum,
          ...(type === 'limit' ? { price: effectivePrice } : {}),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setFeedback({ ok: false, msg: json.error || 'Order rejected' });
      } else {
        setFeedback({
          ok: true,
          msg: `${side === 'buy' ? 'Buy' : 'Sell'} order placed — ${amountNum} ${base.toUpperCase()}`,
        });
        setAmount('');
        onOrderPlaced();
      }
    } catch {
      setFeedback({ ok: false, msg: 'Network error' });
    } finally {
      setSubmitting(false);
    }
  };

  const isBuy = side === 'buy';

  return (
    <div className="p-3 space-y-3">
      {/* Side tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setSide('buy')}
          className={cn(
            'py-1.5 rounded-md text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors',
            isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <TrendingUp className="h-4 w-4" /> Buy
        </button>
        <button
          onClick={() => setSide('sell')}
          className={cn(
            'py-1.5 rounded-md text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors',
            !isBuy ? 'bg-red-500/20 text-red-400' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <TrendingDown className="h-4 w-4" /> Sell
        </button>
      </div>

      {/* Type tabs */}
      <div className="flex gap-4 text-xs border-b border-border pb-2">
        {(['limit', 'market'] as OrderType[]).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn('capitalize', type === t ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground')}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Price */}
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Price ({quote.toUpperCase()})</span>
        {type === 'limit' ? (
          <Input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder={quotePrice ? String(quotePrice) : '0'}
            className="font-mono tabular-nums h-9"
          />
        ) : (
          <div className="h-9 rounded-lg bg-muted px-3 flex items-center font-mono tabular-nums text-sm text-muted-foreground">
            Market · best available
          </div>
        )}
      </label>

      {/* Amount */}
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Amount ({base.toUpperCase()})</span>
        <Input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          className="font-mono tabular-nums h-9"
        />
      </label>

      {/* Total preview */}
      <div className="flex justify-between text-xs py-1">
        <span className="text-muted-foreground">Total</span>
        <span className="font-mono tabular-nums">
          {total > 0 ? `${quote.toUpperCase()} ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
        </span>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={cn(
            'flex items-start gap-2 p-2.5 rounded-lg text-xs',
            feedback.ok
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          )}
        >
          {feedback.ok
            ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={submit}
        disabled={submitting}
        className={cn(
          'w-full h-10 font-semibold text-white',
          isBuy ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
        )}
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isBuy ? `Buy ${base.toUpperCase()}` : `Sell ${base.toUpperCase()}`}
      </Button>
    </div>
  );
}
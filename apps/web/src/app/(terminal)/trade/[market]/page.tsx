export const metadata = { title: 'Trade | KLASSIQ TRANSAKT' };

export default async function TradePage({
  params,
}: {
  params: Promise<{ market: string }>;
}) {
  const { market } = await params;

  return (
    <div className="p-6">
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <h1 className="text-xl font-bold mb-2">
          Spot Terminal — <span className="uppercase text-primary">{market}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Candlestick chart · live order book · limit/market orders · history tabs — the
          centerpiece lands in Phase C.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Until then, classic conversion is still available at{' '}
          <a href="/dashboard/trade" className="underline text-primary">/dashboard/trade</a>.
        </p>
      </div>
    </div>
  );
}
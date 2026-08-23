export const metadata = { title: 'Markets | KLASSIQ TRANSAKT' };

export default function MarketsPage() {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <h1 className="text-xl font-bold mb-2">Markets Board</h1>
        <p className="text-sm text-muted-foreground">
          Live pairs table with search, favourites &amp; sparklines — arriving in Phase B.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Ticker data feed is already live in the top bar ↑
        </p>
      </div>
    </div>
  );
}
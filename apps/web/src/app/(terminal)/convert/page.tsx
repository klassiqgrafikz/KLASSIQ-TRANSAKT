export const metadata = { title: 'Convert | KLASSIQ TRANSAKT' };

export default function ConvertPage() {
  return (
    <div className="p-6 grid place-items-center min-h-[70vh]">
      <div className="rounded-xl border border-border bg-card p-10 text-center max-w-md w-full">
        <h1 className="text-xl font-bold mb-2">Instant Convert</h1>
        <p className="text-sm text-muted-foreground">
          Simple From → To swap at quoted rates — Phase E restyle of the classic converter.
        </p>
        <a
          href="/dashboard/trade"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Use Classic Converter
        </a>
      </div>
    </div>
  );
}
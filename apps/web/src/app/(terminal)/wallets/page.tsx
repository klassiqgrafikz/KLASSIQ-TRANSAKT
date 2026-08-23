export const metadata = { title: 'Wallets | KLASSIQ TRANSAKT' };

export default function WalletsPage() {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <h1 className="text-xl font-bold mb-2">Wallets</h1>
        <p className="text-sm text-muted-foreground">
          Multi-coin balances, deposit addresses (BTC &amp; friends), crypto + NGN
          withdrawals, and your auto-offramp switch — Phase D.
        </p>
      </div>
    </div>
  );
}
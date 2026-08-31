import { ExchangeAdapter, ExchangeProvider, Network, TxnStatus, Bank, DepositAddress, RateQuote, SellOrder, Withdrawal, WebhookEvent, WithdrawalParams, ExchangeService, MarketTicker, WalletBalance, DepositAddressInfo, WithdrawCryptoInput, DepthSnapshot, Kline, MarketTrade, UserOrder, PlaceOrderInput, InitiateNgnOnRampInput, OnRampBankDetails, CashDepositStatus } from './types';
import { YellowCardAdapter } from './yellowcard';
import { QuidaxAdapter } from './quidax';
import { env } from '@klassiq-transakt/config';
import { prisma } from '@klassiq-transakt/db';

class ExchangeServiceImpl implements ExchangeService {
  private primary: ExchangeAdapter;
  private fallback: ExchangeAdapter;
  private bankCache: Bank[] | null = null;
  private bankCacheExpiry: number = 0;

  constructor() {
    this.primary = new YellowCardAdapter();
    this.fallback = new QuidaxAdapter();
  }

  /** Market-data feeds live on Quidax regardless of active trade provider. */
  private get quidaxAdapter(): QuidaxAdapter {
    return this.fallback as QuidaxAdapter;
  }

  private getActiveAdapter(): ExchangeAdapter {
    const provider = env.DEFAULT_EXCHANGE_PROVIDER || 'YELLOW_CARD';
    if (provider === 'QUIDAX') return this.fallback;
    return this.primary;
  }

  private async withFallback<T>(operation: (adapter: ExchangeAdapter) => Promise<T>): Promise<T> {
    const primaryAdapter = this.getActiveAdapter();
    const fallbackAdapter = primaryAdapter === this.primary ? this.fallback : this.primary;

    try {
      return await operation(primaryAdapter);
    } catch (primaryError) {
      console.warn(`Primary exchange (${primaryAdapter.provider}) failed, trying fallback (${fallbackAdapter.provider}):`, primaryError);

      try {
        return await operation(fallbackAdapter);
      } catch (fallbackError) {
        console.error(`Fallback exchange (${fallbackAdapter.provider}) also failed:`, fallbackError);
        throw new Error(`Both exchanges failed. Primary: ${primaryError}. Fallback: ${fallbackError}`);
      }
    }
  }

  async getRate(fromCurrency: string, toCurrency: string): Promise<RateQuote> {
    return this.withFallback(adapter => adapter.getRate(fromCurrency, toCurrency));
  }

  async getAllTickers(): Promise<MarketTicker[]> {
    // Ticker/market-data feeds are a Quidax capability — always route there
    // regardless of which provider handles trades.
    return this.quidaxAdapter.getAllTickers();
  }

  async getTicker(market: string): Promise<MarketTicker> {
    return this.quidaxAdapter.getTicker(market);
  }

  async getDepth(market: string, limit = 20): Promise<DepthSnapshot> {
    return this.quidaxAdapter.getDepth(market, limit);
  }

  async getKlines(market: string, period: number, limit = 200): Promise<Kline[]> {
    return this.quidaxAdapter.getKlines(market, period, limit);
  }

  async getMarketTrades(market: string, limit = 30): Promise<MarketTrade[]> {
    return this.quidaxAdapter.getMarketTrades(market, limit);
  }

  async placeOrder(input: PlaceOrderInput, userId?: string): Promise<SellOrder> {
    const subId = await this.resolveSubAccountId(userId);
    return this.withFallback(adapter => (adapter as unknown as QuidaxAdapter).placeOrder(input, subId));
  }

  async cancelOrder(orderId: string, userId?: string): Promise<void> {
    const subId = await this.resolveSubAccountId(userId);
    return this.withFallback(adapter => (adapter as unknown as QuidaxAdapter).cancelOrder(orderId, subId));
  }

  async getUserOrders(market?: string, limit = 100, userId?: string): Promise<UserOrder[]> {
    const subId = await this.resolveSubAccountId(userId);
    return this.withFallback(adapter => (adapter as unknown as QuidaxAdapter).getUserOrders(market, limit, subId));
  }

  // ── Per-user sub-account helpers ───────────────────────────────
  private isInternalSubAccountId(id?: string | null): boolean {
    return !!id && id.startsWith('INTERNAL:');
  }

  private async resolveSubAccountId(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { quidaxSubAccountId: true, role: true, email: true, name: true },
    });
    if (!user) throw new Error(`User not found: ${userId}`);
    if (user.quidaxSubAccountId) return user.quidaxSubAccountId;
    // ADMIN retains merchant principal to preserve existing funded balance / avoid migration surprise
    if (user.role === 'ADMIN') return undefined;
    const email = user.email;
    const name = user.name || email.split('@')[0];
    const [firstName, ...rest] = name.trim().split(/\s+/);
    const lastName = rest.join(' ') || 'User';
    try {
      const subId = await this.quidaxAdapter.createSubAccount({ email, firstName, lastName });
      await prisma.user.update({
        where: { id: userId },
        data: { quidaxSubAccountId: subId, quidaxProvisionedAt: new Date() },
      });
      return subId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isForbidden = msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.includes('E0107');
      if (isForbidden) {
        console.warn(`[exchangeService] Sub-account creation forbidden for ${email} — falling back to internal ledger with per-user addresses (merchant multi-address)`);
        const internalId = `INTERNAL:${userId}`;
        await prisma.user.update({
          where: { id: userId },
          data: { quidaxSubAccountId: internalId, quidaxProvisionedAt: new Date() },
        });
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'QUIDAX_INTERNAL_FALLBACK',
            entity: 'User',
            entityId: userId,
            after: { email, reason: msg.slice(0, 300) },
          },
        });
        return internalId;
      }
      console.error(`[exchangeService] Failed to provision sub-account for ${userId}`, e);
      throw new Error(`Failed to provision exchange sub-account for ${email}: ${msg}`);
    }
  }

  /** Ensure a Quidax sub-account exists for userId; returns its id. ADMIN returns undefined (merchant). */
  async ensureSubAccountForUser(userId: string): Promise<string | undefined> {
    return this.resolveSubAccountId(userId);
  }

  /** Explicit provision from registration flows — separated for clarity. */
  async provisionSubAccountForUser(userId: string): Promise<string | undefined> {
    return this.resolveSubAccountId(userId);
  }

  // ── Wallets (Quidax capability — now per-user, with INTERNAL fallback) ──────
  private syntheticWalletsForInternal(): WalletBalance[] {
    const list: WalletBalance[] = [
      { currency: 'btc', balance: 0, locked: 0, isCrypto: true, convertedNgn: 0 },
      { currency: 'usdt', balance: 0, locked: 0, isCrypto: true, convertedNgn: 0 },
      { currency: 'eth', balance: 0, locked: 0, isCrypto: true, convertedNgn: 0 },
      { currency: 'usdc', balance: 0, locked: 0, isCrypto: true, convertedNgn: 0 },
      { currency: 'ngn', balance: 0, locked: 0, isCrypto: false, convertedNgn: 0 },
    ];
    return list;
  }

  async getWallets(userId?: string): Promise<WalletBalance[]> {
    const subId = await this.resolveSubAccountId(userId);
    if (this.isInternalSubAccountId(subId)) {
      // For users where Quidax sub-account creation is forbidden (403), use internal ledger.
      // Return synthetic 0 balances for now — webhook + transaction ledger will credit via address mapping.
      // Future: derive from Transaction sums for ledger-based display.
      return this.syntheticWalletsForInternal();
    }
    return this.quidaxAdapter.getWallets(subId);
  }

  async getDefaultDepositAddress(currency: string, userId?: string): Promise<DepositAddressInfo> {
    const subId = await this.resolveSubAccountId(userId);
    if (this.isInternalSubAccountId(subId) && userId) {
      const c = currency.toLowerCase();
      // Check existing per-user address in DB
      const existing = await prisma.userDepositAddress.findFirst({
        where: { userId, currency: c },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        return { id: existing.id, currency: c, address: existing.address, network: existing.network, destinationTag: null };
      }
      // Generate a new merchant address and claim it for this user
      const info = await this.quidaxAdapter.createDepositAddress(c, undefined, undefined);
      if (!info.address) throw new Error('Address generation pending — try again in a few seconds');
      await prisma.userDepositAddress.create({
        data: { userId, currency: c, network: info.network ?? null, address: info.address },
      });
      return info;
    }
    return this.quidaxAdapter.getDefaultDepositAddress(currency, subId);
  }

  async getDepositAddresses(currency: string, userId?: string): Promise<DepositAddressInfo[]> {
    const subId = await this.resolveSubAccountId(userId);
    if (this.isInternalSubAccountId(subId) && userId) {
      const c = currency.toLowerCase();
      const rows = await prisma.userDepositAddress.findMany({ where: { userId, currency: c } });
      return rows.map((r) => ({ id: r.id, currency: r.currency, address: r.address, network: r.network, destinationTag: null }));
    }
    return this.quidaxAdapter.getDepositAddresses(currency, subId);
  }

  async createDepositAddress(currency: string, network?: string, userId?: string): Promise<DepositAddressInfo> {
    const subId = await this.resolveSubAccountId(userId);
    if (this.isInternalSubAccountId(subId) && userId) {
      const c = currency.toLowerCase();
      const info = await this.quidaxAdapter.createDepositAddress(c, network, undefined);
      if (!info.address) return info; // pending
      // Upsert per-user mapping
      await prisma.userDepositAddress.upsert({
        where: { address: info.address },
        update: { userId, network: info.network ?? network ?? null },
        create: { userId, currency: c, network: info.network ?? network ?? null, address: info.address },
      });
      return info;
    }
    return this.quidaxAdapter.createDepositAddress(currency, network, subId);
  }

  async withdrawCrypto(input: WithdrawCryptoInput, userId?: string): Promise<Withdrawal> {
    const subId = await this.resolveSubAccountId(userId);
    return this.quidaxAdapter.withdrawCrypto(input, subId);
  }

  // ── NGN cash-in via Quidax Ramp ─────────────────────────────────
  async initiateNgnOnRamp(input: InitiateNgnOnRampInput) {
    return this.quidaxAdapter.initiateNgnOnRamp(input);
  }
  async confirmNgnOnRamp(reference: string): Promise<OnRampBankDetails> {
    return this.quidaxAdapter.confirmNgnOnRamp(reference);
  }
  async fetchNgnOnRampStatus(reference: string): Promise<{ status: CashDepositStatus; toAmount?: number }> {
    return this.quidaxAdapter.fetchNgnOnRampStatus(reference);
  }

  async getDepositStatus(depositId: string, userId?: string): Promise<{ status: TxnStatus; btcAmount?: number; btcTxHash?: string }> {
    const subId = await this.resolveSubAccountId(userId);
    return this.withFallback(adapter => (adapter as unknown as QuidaxAdapter).getDepositStatus(depositId, subId));
  }

  async sellBtcWithFill(btcAmount: number, userId?: string): Promise<SellOrder> {
    const order = await this.sellBtc(btcAmount, userId);
    if (order.status === TxnStatus.COMPLETED) return order;
    const subId = await this.resolveSubAccountId(userId);
    return this.withFallback(adapter => (adapter as unknown as QuidaxAdapter).pollOrderUntilDone(order.providerOrderId, subId));
  }

  async sellBtc(btcAmount: number, userId?: string): Promise<SellOrder> {
    const subId = await this.resolveSubAccountId(userId);
    return this.withFallback(adapter => (adapter as unknown as QuidaxAdapter).createMarketSell(btcAmount, subId));
  }

  async withdrawNgn(params: WithdrawalParams, userId?: string): Promise<Withdrawal> {
    const subId = await this.resolveSubAccountId(userId);
    return this.withFallback(adapter => (adapter as unknown as QuidaxAdapter).withdrawNgn(params, subId));
  }

  async getBanks(): Promise<Bank[]> {
    const now = Date.now();
    if (this.bankCache && now < this.bankCacheExpiry) {
      return this.bankCache;
    }

    const banks = await this.withFallback(adapter => adapter.getBanks());

    // Cache for 1 hour
    this.bankCache = banks;
    this.bankCacheExpiry = now + 60 * 60 * 1000;

    // Also persist to database for offline access
    await this.persistBanks(banks);

    return banks;
  }

  private async persistBanks(banks: Bank[]): Promise<void> {
    try {
      for (const bank of banks) {
        await prisma.bank.upsert({
          where: { code: bank.code },
          update: {
            name: bank.name,
            slug: bank.slug,
            isActive: true,
          },
          create: {
            code: bank.code,
            name: bank.name,
            slug: bank.slug || bank.code,
            isActive: true,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to persist banks to database:', error);
    }
  }

  verifyWebhook(payload: string, signature: string): WebhookEvent {
    // Try primary first, then fallback
    try {
      return this.primary.verifyWebhook(payload, signature);
    } catch (primaryError) {
      try {
        return this.fallback.verifyWebhook(payload, signature);
      } catch (fallbackError) {
        throw new Error(`Webhook verification failed on both exchanges: ${primaryError}, ${fallbackError}`);
      }
    }
  }

  // Additional service methods

  async getBankByCode(code: string): Promise<Bank | null> {
    const banks = await this.getBanks();
    return banks.find(b => b.code === code) || null;
  }

  async getBankBySlug(slug: string): Promise<Bank | null> {
    const banks = await this.getBanks();
    return banks.find(b => b.slug === slug) || null;
  }

  async searchBanks(query: string): Promise<Bank[]> {
    const banks = await this.getBanks();
    const lowerQuery = query.toLowerCase();
    return banks.filter(b =>
      b.name.toLowerCase().includes(lowerQuery) ||
      b.code.includes(lowerQuery) ||
      (b.slug || '').includes(lowerQuery)
    );
  }

  async verifyBankAccount(bankCode: string, accountNumber: string): Promise<{ accountName: string; matched: boolean }> {
    // This would integrate with NIBSS or a third-party verification service
    // For now, return mock verification
    // TODO: Integrate with NIBSS NUBAN validation or providers like Mono, OnePipe
    return {
      accountName: 'Verified Account Holder',
      matched: true,
    };
  }

  async calculatePlatformFee(amount: number): Promise<number> {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: 'singleton' },
    });

    const feeBps = settings?.platformFeeBps || env.PLATFORM_FEE_BPS;
    return Math.round(amount * feeBps / 10000 * 100) / 100; // Round to 2 decimal places
  }

  async getDailyVolumeLimit(kycLevel: 'NONE' | 'BASIC' | 'FULL'): Promise<number> {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: 'singleton' },
    });

    switch (kycLevel) {
      case 'FULL':
        return Number(settings?.maxTradeNgnDailyFull ?? env.MAX_TRADE_NGN_DAILY_FULL);
      case 'BASIC':
        return Number(settings?.maxTradeNgnDailyBasic ?? env.MAX_TRADE_NGN_DAILY_BASIC);
      default:
        return env.MIN_TRADE_NGN;
    }
  }
}

export const exchangeService = new ExchangeServiceImpl();
export default exchangeService;
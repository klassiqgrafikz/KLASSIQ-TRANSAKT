import { ExchangeAdapter, ExchangeProvider, Network, TxnStatus, Bank, DepositAddress, RateQuote, SellOrder, Withdrawal, WebhookEvent, WithdrawalParams, ExchangeService, MarketTicker, WalletBalance, DepositAddressInfo, WithdrawCryptoInput, DepthSnapshot, Kline, MarketTrade, UserOrder, PlaceOrderInput } from './types';
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

  async placeOrder(input: PlaceOrderInput): Promise<SellOrder> {
    return this.withFallback(adapter => adapter.placeOrder(input));
  }

  async cancelOrder(orderId: string): Promise<void> {
    return this.withFallback(adapter => adapter.cancelOrder(orderId));
  }

  async getUserOrders(market?: string, limit = 100): Promise<UserOrder[]> {
    return this.withFallback(adapter => adapter.getUserOrders(market, limit));
  }

  // ── Wallets (Quidax capability) ──────────────────────────────────
  async getWallets(): Promise<WalletBalance[]> {
    return this.quidaxAdapter.getWallets();
  }

  async getDefaultDepositAddress(currency: string): Promise<DepositAddressInfo> {
    return this.quidaxAdapter.getDefaultDepositAddress(currency);
  }

  async getDepositAddresses(currency: string): Promise<DepositAddressInfo[]> {
    return this.quidaxAdapter.getDepositAddresses(currency);
  }

  async createDepositAddress(currency: string, network?: string): Promise<DepositAddressInfo> {
    return this.quidaxAdapter.createDepositAddress(currency, network);
  }

  async withdrawCrypto(input: WithdrawCryptoInput): Promise<Withdrawal> {
    return this.quidaxAdapter.withdrawCrypto(input);
  }

  async getDepositStatus(depositId: string): Promise<{ status: TxnStatus; btcAmount?: number; btcTxHash?: string }> {
    return this.withFallback(adapter => adapter.getDepositStatus(depositId));
  }

  async sellBtcWithFill(btcAmount: number): Promise<SellOrder> {
    const order = await this.sellBtc(btcAmount);
    if (order.status === TxnStatus.COMPLETED) return order;
    return this.withFallback(adapter => adapter.pollOrderUntilDone(order.providerOrderId));
  }

  async sellBtc(btcAmount: number): Promise<SellOrder> {
    return this.withFallback(adapter => adapter.createMarketSell(btcAmount));
  }

  async withdrawNgn(params: WithdrawalParams): Promise<Withdrawal> {
    return this.withFallback(adapter => adapter.withdrawNgn(params));
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
import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { ExchangeAdapter, ExchangeProvider, Network, TxnStatus, Bank, DepositAddress, DepositAddressInfo, RateQuote, SellOrder, Withdrawal, WebhookEvent, WithdrawalParams, MarketTicker, DepthSnapshot, DepthLevel, Kline, MarketTrade, UserOrder, PlaceOrderInput, WalletBalance, WithdrawCryptoInput } from './types';
import { env } from '@klassiq-transakt/config';

const QuidaxWebhookSchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()),
});

export class QuidaxAdapter implements ExchangeAdapter {
  readonly provider = ExchangeProvider.QUIDAX;
  private client: AxiosInstance;
  private webhookSecret: string;

  constructor() {
    this.webhookSecret = env.QUIDAX_WEBHOOK_SECRET || '';
    this.client = axios.create({
      baseURL: env.QUIDAX_BASE_URL,
      headers: {
        'Authorization': `Bearer ${env.QUIDAX_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  async getRate(fromCurrency: string, toCurrency: string): Promise<RateQuote> {
    const market = `${fromCurrency.toLowerCase()}${toCurrency.toLowerCase()}`;
    const response = await this.client.get(`/markets/${market}/ticker`);
    const data = response.data.data;

    return {
      fromCurrency,
      toCurrency,
      rate: parseFloat(data.last),
      fee: 0, // Quidax fees are included in market order execution
      provider: this.provider,
      expiresAt: new Date(Date.now() + 60000),
    };
  }

  async getMarketPrice(base: string, quote: string): Promise<number> {
    const quoteResponse = await this.getRate(base, quote);
    return quoteResponse.rate;
  }

  private mapTicker(market: string, t: { last?: unknown; buy?: unknown; sell?: unknown; high?: unknown; low?: unknown; open?: unknown; vol?: unknown }): MarketTicker {
    const num = (v: unknown) => parseFloat(String(v ?? '0')) || 0;
    const [baseUnit, ...rest] = market.split(/(?=ngn|usdt|ghs|usd|xaf|xof|zar|kes|btc$)/i);
    const open = num(t.open);
    const last = num(t.last);
    return {
      market,
      base: baseUnit || market,
      quote: rest.join('') || '',
      last,
      bid: num(t.buy) || undefined,
      ask: num(t.sell) || undefined,
      open,
      high: num(t.high),
      low: num(t.low),
      volume: num(t.vol),
      changePct: open > 0 ? Number((((last - open) / open) * 100).toFixed(2)) : 0,
    };
  }

  async getTicker(market: string): Promise<MarketTicker> {
    const response = await this.client.get(`/markets/tickers/${market.toLowerCase()}`);
    const payload = response.data?.data?.[market.toLowerCase()]?.ticker;
    if (!payload) throw new Error(`No ticker for market ${market}`);
    return this.mapTicker(market.toLowerCase(), payload);
  }

  async getAllTickers(): Promise<MarketTicker[]> {
    const response = await this.client.get('/markets/tickers');
    const data = (response.data?.data ?? {}) as Record<string, { ticker?: Record<string, unknown> }>;
    return Object.entries(data)
      .filter(([, v]) => v?.ticker)
      .map(([market, v]) => this.mapTicker(market, v.ticker as never));
  }

  async getDepth(market: string, limit = 20): Promise<DepthSnapshot> {
    const m = market.toLowerCase();
    const response = await this.client.get(`/markets/${m}/depth`, { params: { limit } });
    const d = response.data?.data ?? {};
    // Quidax returns both sides sorted high→low; normalize: asks ascending, bids descending
    const toLevels = (arr: unknown): DepthLevel[] =>
      Array.isArray(arr)
        ? arr
            .map((row) => ({ price: Number(row?.[0] ?? 0), volume: Number(row?.[1] ?? 0) }))
            .filter(l => l.price > 0 && l.volume > 0)
        : [];
    const asks = toLevels(d.asks).sort((a, b) => a.price - b.price);
    const bids = toLevels(d.bids).sort((a, b) => b.price - a.price);
    return { asks, bids, timestamp: Number(d.timestamp ?? Date.now()) };
  }

  async getKlines(market: string, period: number, limit = 200): Promise<Kline[]> {
    const m = market.toLowerCase();
    const response = await this.client.get(`/markets/${m}/k`, { params: { period, limit } });
    const rows = (Array.isArray(response.data?.data) ? response.data.data : []) as unknown[][];
    return rows.map(r => [Number(r[0]), Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4]), Number(r[5] ?? 0)] as Kline);
  }

  async getMarketTrades(market: string, limit = 30): Promise<MarketTrade[]> {
    const m = market.toLowerCase();
    try {
      const response = await this.client.get(`/markets/${m}/trades`, { params: { limit } });
      const rows = (Array.isArray(response.data?.data) ? response.data.data : []) as Record<string, unknown>[];
      return rows.map(r => ({
        id: (r.tid ?? r.id ?? Math.random()) as string | number,
        side: (String(r.type ?? r.side ?? 'buy').toLowerCase() === 'sell' ? 'sell' : 'buy'),
        price: Number(r.price ?? 0),
        amount: Number(r.amount ?? 0),
        createdAt: Number(r.date ?? r.created_at ?? 0),
      }));
    } catch {
      return []; // feed optional — terminal works without it
    }
  }

  async placeOrder(input: PlaceOrderInput): Promise<SellOrder> {
    const body: Record<string, unknown> = {
      market: input.market.toLowerCase(),
      side: input.side,
      ord_type: input.type,
      volume: String(input.volume),
    };
    if (input.type === 'limit') {
      if (!input.price || input.price <= 0) throw new Error('Limit orders require a positive price');
      body.price = String(input.price);
    }
    const response = await this.client.post('/users/me/orders', body);
    if (response.data?.status !== 'success') {
      throw new Error(`Order rejected: ${response.data?.message ?? 'unknown'}`);
    }
    return this.mapSellOrder(response.data.data);
  }

  async cancelOrder(orderId: string): Promise<void> {
    const response = await this.client.post(`/users/me/orders/${orderId}/cancel`);
    if (response.data?.status && response.data.status !== 'success') {
      throw new Error(`Cancel failed: ${response.data.message ?? 'unknown'}`);
    }
  }

  private static readonly OPEN_STATES = new Set(['wait', 'new', 'new_', 'pending', 'partially', 'partial']);

  async getUserOrders(market?: string, limit = 100): Promise<UserOrder[]> {
    const response = await this.client.get('/users/me/orders', {
      params: { ...(market ? { market: market.toLowerCase() } : {}), limit },
    });
    const rows = (Array.isArray(response.data?.data) ? response.data.data : []) as Record<string, unknown>[];
    return rows.map(r => {
      const state = String(r.state ?? '').toLowerCase();
      return {
        id: String(r.id ?? ''),
        market: String(r.market ?? r.currency ?? ''),
        side: (String(r.side ?? '').toLowerCase() === 'sell' ? 'sell' : 'buy'),
        type: (String(r.ord_type ?? 'limit').toLowerCase() === 'market' ? 'market' : 'limit'),
        price: parseFloat(String(r.price ?? '0')) || 0,
        avgPrice: parseFloat(String(r.avg_price ?? '0')) || 0,
        originVolume: parseFloat(String(r.origin_volume ?? r.volume ?? '0')) || 0,
        executedVolume: parseFloat(String(r.executed_volume ?? '0')) || 0,
        state,
        open: QuidaxAdapter.OPEN_STATES.has(state),
        createdAt: new Date(String(r.created_at ?? Date.now())),
      };
    });
  }

  // ── Wallets ───────────────────────────────────────────────────────

  async getWallets(): Promise<WalletBalance[]> {
    const response = await this.client.get('/users/me/accounts');
    const rows = (Array.isArray(response.data?.data) ? response.data.data : []) as Record<string, unknown>[];
    return rows.map(w => ({
      currency: String(w.currency ?? '').toLowerCase(),
      balance: parseFloat(String(w.balance ?? '0')) || 0,
      locked: parseFloat(String(w.locked ?? '0')) || 0,
      staked: parseFloat(String(w.staked ?? '0')) || 0,
      isCrypto: Boolean(w.is_crypto),
      convertedNgn: parseFloat(String(w.converted_balance ?? '0')) || 0,
    }));
  }

  async getDefaultDepositAddress(currency: string): Promise<DepositAddressInfo> {
    const c = currency.toLowerCase();
    const response = await this.client.get(`/users/me/wallets/${c}/address`);
    const d = response.data?.data ?? {};
    return {
      id: String(d.id ?? ''),
      currency: String(d.currency ?? c).toLowerCase(),
      address: String(d.address ?? ''),
      network: (d.network as string | null) ?? null,
      destinationTag: (d.destination_tag as string | null) ?? null,
    };
  }

  async getDepositAddresses(currency: string): Promise<DepositAddressInfo[]> {
    const c = currency.toLowerCase();
    const response = await this.client.get(`/users/me/wallets/${c}/addresses`);
    const rows = (Array.isArray(response.data?.data) ? response.data.data : []) as Record<string, unknown>[];
    return rows.map(d => ({
      id: String(d.id ?? ''),
      currency: String(d.currency ?? c).toLowerCase(),
      address: String(d.address ?? ''),
      network: (d.network as string | null) ?? null,
      destinationTag: (d.destination_tag as string | null) ?? null,
    }));
  }

  async createDepositAddress(currency: string, network?: string): Promise<DepositAddressInfo> {
    const c = currency.toLowerCase();
    const response = await this.client.post(`/users/me/wallets/${c}/addresses`, null, {
      params: network ? { network } : undefined,
    });
    const d = response.data?.data ?? {};
    // Generation is async — address may be null until wallet.address.generated fires
    return {
      id: String(d.id ?? ''),
      currency: String(d.currency ?? c).toLowerCase(),
      address: String(d.address ?? ''),
      network: (d.network as string | null) ?? network ?? null,
      destinationTag: (d.destination_tag as string | null) ?? null,
    };
  }

  async withdrawCrypto(input: WithdrawCryptoInput): Promise<Withdrawal> {
    const response = await this.client.post('/users/me/withdraws', {
      currency: input.currency.toLowerCase(),
      amount: String(input.amount),
      fund_uid: input.address,
      ...(input.network ? { network: input.network } : {}),
      reference: input.reference,
      narration: 'KLASSIQ TRANSAKT withdrawal',
    });

    if (response.data?.status !== 'success') {
      throw new Error(`Crypto withdrawal failed: ${response.data?.message ?? 'unknown'}`);
    }
    return this.mapWithdrawal(response.data.data);
  }

  async getDepositStatus(depositId: string): Promise<{ status: TxnStatus; btcAmount?: number; btcTxHash?: string }> {
    const response = await this.client.get(`/users/me/deposits/${depositId}`);
    const data = response.data.data;

    const statusMap: Record<string, TxnStatus> = {
      submitted: TxnStatus.PENDING,
      confirmed: TxnStatus.COMPLETED,
      accepted: TxnStatus.COMPLETED,
      rejected: TxnStatus.FAILED,
    };

    return {
      status: statusMap[data.status] || TxnStatus.PENDING,
      btcAmount: data.amount ? parseFloat(data.amount) : undefined,
      btcTxHash: data.txid,
    };
  }

  async createMarketSell(btcAmount: number): Promise<SellOrder> {
    const response = await this.client.post('/users/me/orders', {
      market: 'btcngn',
      side: 'sell',
      ord_type: 'market',
      volume: btcAmount.toString(),
    });

    const data = response.data.data;
    return this.mapSellOrder(data);
  }

  async getOrderStatus(orderId: string): Promise<SellOrder> {
    const response = await this.client.get(`/users/me/orders/${orderId}`);
    return this.mapSellOrder(response.data.data);
  }

  async pollOrderUntilDone(orderId: string, timeoutMs = 15000, intervalMs = 1500): Promise<SellOrder> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const order = await this.getOrderStatus(orderId);
      if (order.status === TxnStatus.COMPLETED) return order;
      if (order.status === TxnStatus.FAILED) throw new Error(`Order failed: ${orderId}`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Order fill timeout after ${timeoutMs}ms for order ${orderId}`);
  }

  async withdrawNgn(params: WithdrawalParams): Promise<Withdrawal> {
    const response = await this.client.post('/users/me/withdraws', {
      currency: 'ngn',
      amount: params.amount.toFixed(2),
      fund_uid: params.accountNumber,
      fund_uid2: params.bankCode,
      reference: params.reference,
      narration: params.narration || 'KLASSIQ TRANSAKT withdrawal',
    });

    const data = response.data.data;
    return this.mapWithdrawal(data);
  }

  async getWithdrawalStatus(withdrawalId: string): Promise<Withdrawal> {
    const response = await this.client.get(`/users/me/withdraws/${withdrawalId}`);
    return this.mapWithdrawal(response.data.data);
  }

  async getBanks(): Promise<Bank[]> {
    try {
      const response = await axios.get('https://ramp-be.quidax.io/api/v1/merchants/custodial/banks', {
        params: { country: 'NG' },
        headers: {
          'x-private-key': env.QUIDAX_API_KEY,
        },
      });

      return response.data.data.map((bank: any) => ({
        code: bank.code,
        name: bank.name,
        slug: bank.name.toLowerCase().replace(/\s+/g, '-'),
      }));
    } catch (error) {
      console.warn('Failed to fetch banks from Quidax, using fallback');
      return this.getFallbackBanks();
    }
  }

  private getFallbackBanks(): Bank[] {
    return [
      { code: '044', name: 'Access Bank', slug: 'access-bank' },
      { code: '023', name: 'Citi Bank', slug: 'citi-bank' },
      { code: '050', name: 'Ecobank Nigeria', slug: 'ecobank-nigeria' },
      { code: '011', name: 'First Bank of Nigeria', slug: 'first-bank-of-nigeria' },
      { code: '214', name: 'First City Monument Bank', slug: 'first-city-monument-bank' },
      { code: '070', name: 'Fidelity Bank', slug: 'fidelity-bank' },
      { code: '058', name: 'Guaranty Trust Bank', slug: 'guaranty-trust-bank' },
      { code: '030', name: 'Heritage Bank', slug: 'heritage-bank' },
      { code: '082', name: 'Keystone Bank', slug: 'keystone-bank' },
      { code: '076', name: 'Polaris Bank', slug: 'polaris-bank' },
      { code: '101', name: 'Providus Bank', slug: 'providus-bank' },
      { code: '221', name: 'Stanbic IBTC Bank', slug: 'stanbic-ibtc-bank' },
      { code: '068', name: 'Standard Chartered Bank', slug: 'standard-chartered-bank' },
      { code: '232', name: 'Sterling Bank', slug: 'sterling-bank' },
      { code: '100', name: 'Suntrust Bank', slug: 'suntrust-bank' },
      { code: '032', name: 'Union Bank of Nigeria', slug: 'union-bank-of-nigeria' },
      { code: '033', name: 'United Bank for Africa', slug: 'united-bank-for-africa' },
      { code: '215', name: 'Unity Bank', slug: 'unity-bank' },
      { code: '035', name: 'Wema Bank', slug: 'wema-bank' },
      { code: '057', name: 'Zenith Bank', slug: 'zenith-bank' },
    ];
  }

  verifyWebhook(payload: string, signature: string): WebhookEvent {
    const crypto = require('crypto');

    const parts = signature.split(',');
    if (parts.length !== 2) {
      throw new Error('Invalid Quidax signature format');
    }

    const timestampPart = parts[0].split('=');
    const signaturePart = parts[1].split('=');

    if (timestampPart[0] !== 't' || signaturePart[0] !== 'v1') {
      throw new Error('Invalid Quidax signature format');
    }

    const timestamp = timestampPart[1];
    const receivedSignature = signaturePart[1];

    const expectedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(expectedPayload)
      .digest('hex');

    if (!crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )) {
      throw new Error('Invalid Quidax webhook signature');
    }

    const parsed = JSON.parse(payload);
    const validated = QuidaxWebhookSchema.parse(parsed);

    return {
      event: validated.event,
      provider: this.provider,
      data: validated.data,
      rawPayload: payload,
      signature,
      timestamp: parseInt(timestamp, 10) * 1000,
    };
  }

  parseWebhookEvent(event: WebhookEvent): {
    type: 'deposit' | 'sell' | 'withdraw';
    status: TxnStatus;
    externalId: string;
    amount?: number;
    currency?: string;
    metadata: Record<string, unknown>;
  } {
    const data = event.data as Record<string, unknown>;

    if (event.event === 'deposit.successful') {
      return {
        type: 'deposit',
        status: TxnStatus.COMPLETED,
        externalId: data.id as string,
        amount: data.amount ? parseFloat(data.amount as string) : undefined,
        currency: data.currency as string,
        metadata: data,
      };
    }

    if (event.event === 'sell_transaction.successful' || event.event === 'sell_transaction.processing') {
      const status = data.status === 'completed' ? TxnStatus.COMPLETED : TxnStatus.PROCESSING;
      return {
        type: 'sell',
        status,
        externalId: data.public_id as string,
        amount: data.from_amount ? parseFloat(data.from_amount as string) : undefined,
        currency: data.from_currency as string,
        metadata: data,
      };
    }

    if (event.event === 'withdraw.successful') {
      return {
        type: 'withdraw',
        status: TxnStatus.COMPLETED,
        externalId: data.id as string,
        amount: data.amount ? parseFloat(data.amount as string) : undefined,
        currency: data.currency as string,
        metadata: data,
      };
    }

    return {
      type: 'deposit',
      status: TxnStatus.PENDING,
      externalId: 'unknown',
      metadata: data,
    };
  }

  private mapSellOrder(data: any): SellOrder {
    const statusMap: Record<string, TxnStatus> = {
      wait: TxnStatus.PENDING,
      done: TxnStatus.COMPLETED,
      cancel: TxnStatus.FAILED,
      reject: TxnStatus.FAILED,
      partial: TxnStatus.PROCESSING,
    };

    return {
      id: data.id,
      btcAmount: parseFloat(data.origin_volume?.amount || data.volume?.amount || '0'),
      ngnAmount: parseFloat(data.executed_volume?.amount || '0') * parseFloat(data.avg_price?.amount || '0'),
      rate: parseFloat(data.avg_price?.amount || data.price?.amount || '0'),
      fee: 0,
      status: statusMap[data.status] || TxnStatus.PENDING,
      providerOrderId: data.id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      completedAt: data.done_at ? new Date(data.done_at) : undefined,
    };
  }

  private mapWithdrawal(data: any): Withdrawal {
    const statusMap: Record<string, TxnStatus> = {
      Processing: TxnStatus.PROCESSING,
      Done: TxnStatus.COMPLETED,
      Rejected: TxnStatus.FAILED,
      Failed: TxnStatus.FAILED,
    };

    return {
      id: data.id,
      ngnAmount: parseFloat(data.amount || '0'),
      fee: parseFloat(data.fee || '0'),
      bankCode: data.fund_uid2 || data.recipient?.details?.bank_code || '',
      accountNumber: data.fund_uid || '',
      status: statusMap[data.status] || TxnStatus.PENDING,
      providerWithdrawalId: data.id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      completedAt: data.done_at ? new Date(data.done_at) : undefined,
    };
  }
}
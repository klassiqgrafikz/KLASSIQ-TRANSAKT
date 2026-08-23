import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { ExchangeAdapter, ExchangeProvider, Network, TxnStatus, Bank, DepositAddress, RateQuote, SellOrder, Withdrawal, WebhookEvent, WithdrawalParams, MarketTicker, DepthSnapshot, Kline, MarketTrade, UserOrder, PlaceOrderInput } from './types';
import { env } from '@klassiq-transakt/config';

const YellowCardWebhookSchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()),
});

export class YellowCardAdapter implements ExchangeAdapter {
  readonly provider = ExchangeProvider.YELLOW_CARD;
  private client: AxiosInstance;
  private webhookSecret: string;

  constructor() {
    this.webhookSecret = env.YELLOWCARD_WEBHOOK_SECRET || '';
    this.client = axios.create({
      baseURL: env.YELLOWCARD_BASE_URL,
      headers: {
        'Authorization': `Bearer ${env.YELLOWCARD_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  async getRate(fromCurrency: string, toCurrency: string): Promise<RateQuote> {
    const response = await this.client.get('/api/v1/rates', {
      params: { from: fromCurrency, to: toCurrency },
    });

    const data = response.data.data;
    return {
      fromCurrency,
      toCurrency,
      rate: parseFloat(data.rate),
      fee: parseFloat(data.fee || '0'),
      provider: this.provider,
      expiresAt: new Date(Date.now() + 60000), // 1 minute
    };
  }

  async getMarketPrice(base: string, quote: string): Promise<number> {
    const quoteResponse = await this.getRate(base, quote);
    return quoteResponse.rate;
  }

  async getTicker(market: string): Promise<MarketTicker> {
    // Yellow Card has no multi-pair ticker concept — unsupported until needed.
    throw new Error(`getTicker not supported by ${this.provider}`);
  }

  async getAllTickers(): Promise<MarketTicker[]> {
    throw new Error(`getAllTickers not supported by ${this.provider}`);
  }

  async getDepth(_market: string, _limit?: number): Promise<DepthSnapshot> {
    throw new Error(`getDepth not supported by ${this.provider}`);
  }

  async getKlines(_market: string, _period: number, _limit?: number): Promise<Kline[]> {
    throw new Error(`getKlines not supported by ${this.provider}`);
  }

  async getMarketTrades(_market: string, _limit?: number): Promise<MarketTrade[]> {
    throw new Error(`getMarketTrades not supported by ${this.provider}`);
  }

  async placeOrder(input: PlaceOrderInput): Promise<SellOrder> {
    // Yellow Card sell flow differs; route via existing createMarketSell for market side.
    if (input.type === 'market' && input.side === 'sell') return this.createMarketSell(input.volume);
    throw new Error(`placeOrder (${input.type}/${input.side}) not supported by ${this.provider} yet`);
  }

  async cancelOrder(_orderId: string): Promise<void> {
    throw new Error(`cancelOrder not supported by ${this.provider}`);
  }

  async getUserOrders(_market?: string, _limit?: number): Promise<UserOrder[]> {
    throw new Error(`getUserOrders not supported by ${this.provider}`);
  }

  async createDepositAddress(network: Network, amount?: number): Promise<DepositAddress> {
    const currency = network === Network.LIGHTNING ? 'BTC' : 'BTC';
    const response = await this.client.post('/api/v1/deposit-address', {
      currency,
      network: network === Network.LIGHTNING ? 'lightning' : 'bitcoin',
      amount,
    });

    const data = response.data.data;
    return {
      address: data.address,
      network,
      qrCode: data.qr_code,
      depositId: data.id,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    };
  }

  async getDepositStatus(depositId: string): Promise<{ status: TxnStatus; btcAmount?: number; btcTxHash?: string }> {
    const response = await this.client.get(`/api/v1/deposits/${depositId}`);
    const data = response.data.data;

    const statusMap: Record<string, TxnStatus> = {
      pending: TxnStatus.PENDING,
      confirmed: TxnStatus.COMPLETED,
      failed: TxnStatus.FAILED,
      processing: TxnStatus.PROCESSING,
    };

    return {
      status: statusMap[data.status] || TxnStatus.PENDING,
      btcAmount: data.amount ? parseFloat(data.amount) : undefined,
      btcTxHash: data.txid,
    };
  }

  async createMarketSell(btcAmount: number): Promise<SellOrder> {
    const response = await this.client.post('/api/v1/sell', {
      from_currency: 'BTC',
      to_currency: 'NGN',
      amount: btcAmount.toString(),
      type: 'market',
    });

    const data = response.data.data;
    return this.mapSellOrder(data);
  }

  async getOrderStatus(orderId: string): Promise<SellOrder> {
    const response = await this.client.get(`/api/v1/sell/${orderId}`);
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
    const response = await this.client.post('/api/v1/withdraw', {
      currency: 'NGN',
      amount: params.amount.toFixed(2),
      bank_code: params.bankCode,
      account_number: params.accountNumber,
      account_name: params.accountName,
      reference: params.reference,
      narration: params.narration || 'KLASSIQ TRANSAKT withdrawal',
    });

    const data = response.data.data;
    return this.mapWithdrawal(data);
  }

  async getWithdrawalStatus(withdrawalId: string): Promise<Withdrawal> {
    const response = await this.client.get(`/api/v1/withdraw/${withdrawalId}`);
    return this.mapWithdrawal(response.data.data);
  }

  async getBanks(): Promise<Bank[]> {
    try {
      const response = await this.client.get('/api/v1/banks', {
        params: { country: 'NG' },
      });

      return response.data.data.map((bank: any) => ({
        code: bank.code,
        name: bank.name,
        slug: bank.name.toLowerCase().replace(/\s+/g, '-'),
      }));
    } catch (error) {
      console.warn('Failed to fetch banks from Yellow Card, using fallback');
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
    // Yellow Card uses HMAC SHA256 with the webhook secret
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid Yellow Card webhook signature');
    }

    const parsed = JSON.parse(payload);
    const validated = YellowCardWebhookSchema.parse(parsed);

    return {
      event: validated.event,
      provider: this.provider,
      data: validated.data,
      rawPayload: payload,
      signature,
      timestamp: Date.now(),
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

    if (event.event.includes('deposit')) {
      return {
        type: 'deposit',
        status: this.mapStatus(data.status as string),
        externalId: data.id as string,
        amount: data.amount ? parseFloat(data.amount as string) : undefined,
        currency: data.currency as string,
        metadata: data,
      };
    }

    if (event.event.includes('sell') || event.event.includes('trade')) {
      return {
        type: 'sell',
        status: this.mapStatus(data.status as string),
        externalId: data.id as string,
        amount: data.from_amount ? parseFloat(data.from_amount as string) : undefined,
        currency: data.from_currency as string,
        metadata: data,
      };
    }

    if (event.event.includes('withdraw')) {
      return {
        type: 'withdraw',
        status: this.mapStatus(data.status as string),
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

  private mapStatus(status: string): TxnStatus {
    const statusMap: Record<string, TxnStatus> = {
      pending: TxnStatus.PENDING,
      confirmed: TxnStatus.COMPLETED,
      completed: TxnStatus.COMPLETED,
      failed: TxnStatus.FAILED,
      rejected: TxnStatus.FAILED,
      processing: TxnStatus.PROCESSING,
      accepted: TxnStatus.COMPLETED,
    };
    return statusMap[status?.toLowerCase()] || TxnStatus.PENDING;
  }

  private mapSellOrder(data: any): SellOrder {
    const statusMap: Record<string, TxnStatus> = {
      pending: TxnStatus.PENDING,
      processing: TxnStatus.PROCESSING,
      completed: TxnStatus.COMPLETED,
      failed: TxnStatus.FAILED,
      rejected: TxnStatus.FAILED,
    };

    return {
      id: data.id,
      btcAmount: parseFloat(data.from_amount || '0'),
      ngnAmount: parseFloat(data.to_amount || '0'),
      rate: parseFloat(data.rate || '0'),
      fee: parseFloat(data.fee || '0'),
      status: statusMap[data.status] || TxnStatus.PENDING,
      providerOrderId: data.id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    };
  }

  private mapWithdrawal(data: any): Withdrawal {
    const statusMap: Record<string, TxnStatus> = {
      pending: TxnStatus.PENDING,
      processing: TxnStatus.PROCESSING,
      completed: TxnStatus.COMPLETED,
      done: TxnStatus.COMPLETED,
      failed: TxnStatus.FAILED,
      rejected: TxnStatus.FAILED,
    };

    return {
      id: data.id,
      ngnAmount: parseFloat(data.amount || '0'),
      fee: parseFloat(data.fee || '0'),
      bankCode: data.bank_code || data.recipient?.details?.bank_code || '',
      accountNumber: data.account_number || data.recipient?.details?.account_number || '',
      status: statusMap[data.status] || TxnStatus.PENDING,
      providerWithdrawalId: data.id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    };
  }
}
import { z } from 'zod';

export const ExchangeProvider = {
  YELLOW_CARD: 'YELLOW_CARD',
  QUIDAX: 'QUIDAX',
} as const;

export type ExchangeProvider = (typeof ExchangeProvider)[keyof typeof ExchangeProvider];

export const Network = {
  BITCOIN: 'BITCOIN',
  LIGHTNING: 'LIGHTNING',
} as const;

export type Network = (typeof Network)[keyof typeof Network];

export const TxnStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
} as const;

export type TxnStatus = (typeof TxnStatus)[keyof typeof TxnStatus];

export interface Bank {
  code: string;
  name: string;
  slug?: string;
  logoUrl?: string;
}

export interface MarketTicker {
  market: string;        // e.g. 'btcngn'
  base: string;          // e.g. 'btc'
  quote: string;         // e.g. 'ngn'
  last: number;
  bid?: number;
  ask?: number;
  open: number;
  high: number;
  low: number;
  volume: number;        // base-unit 24h volume
  changePct: number;     // computed vs open
}

export interface DepthLevel { price: number; volume: number; }
export interface DepthSnapshot { asks: DepthLevel[]; bids: DepthLevel[]; timestamp: number; }

/** [timeSec, open, high, low, close, baseVolume] */
export type Kline = [number, number, number, number, number, number];

export interface MarketTrade {
  id: string | number;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  createdAt: number; // epoch seconds
}

export interface UserOrder {
  id: string;
  market: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  price: number;
  avgPrice: number;
  originVolume: number;
  executedVolume: number;
  state: string;          // raw provider state
  open: boolean;          // normalized
  createdAt: Date;
}

export interface PlaceOrderInput {
  market: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  volume: number;
  price?: number;        // required for limit
}

export interface WalletBalance {
  currency: string;
  balance: number;
  locked: number;
  staked?: number;
  isCrypto: boolean;
  convertedNgn: number;
}

export interface DepositAddressInfo {
  id: string;
  currency: string;
  address: string;
  network?: string | null;
  destinationTag?: string | null;
}

export interface WithdrawCryptoInput {
  currency: string;      // e.g. 'btc', 'usdt'
  amount: number;
  address: string;
  network?: string;      // required by some chains
  reference: string;
}

export interface DepositAddress {
  address: string;
  network: Network;
  qrCode?: string;
  expiresAt?: Date;
  depositId: string;
}

export interface RateQuote {
  fromCurrency: string;
  toCurrency: string;
  rate: number; // toCurrency per fromCurrency (e.g., NGN per BTC)
  fee: number;
  provider: ExchangeProvider;
  expiresAt: Date;
}

export interface SellOrder {
  id: string;
  btcAmount: number;
  ngnAmount: number;
  rate: number;
  fee: number;
  status: TxnStatus;
  providerOrderId: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface Withdrawal {
  id: string;
  ngnAmount: number;
  fee: number;
  bankCode: string;
  accountNumber: string;
  status: TxnStatus;
  providerWithdrawalId: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface WebhookEvent {
  event: string;
  provider: ExchangeProvider;
  data: Record<string, unknown>;
  rawPayload: string;
  signature: string;
  timestamp: number;
}

export interface ExchangeAdapter {
  readonly provider: ExchangeProvider;

  // Rate & Market Data
  getRate(fromCurrency: string, toCurrency: string): Promise<RateQuote>;
  getMarketPrice(base: string, quote: string): Promise<number>;
  getAllTickers(): Promise<MarketTicker[]>;
  getTicker(market: string): Promise<MarketTicker>;
  getDepth(market: string, limit?: number): Promise<DepthSnapshot>;
  getKlines(market: string, period: number, limit?: number): Promise<Kline[]>;
  getMarketTrades(market: string, limit?: number): Promise<MarketTrade[]>;

  // Trading
  placeOrder(input: PlaceOrderInput): Promise<SellOrder>;
  cancelOrder(orderId: string): Promise<void>;
  getUserOrders(market?: string, limit?: number): Promise<UserOrder[]>;

  // Wallets
  getWallets(): Promise<WalletBalance[]>;
  getDefaultDepositAddress(currency: string): Promise<DepositAddressInfo>;
  getDepositAddresses(currency: string): Promise<DepositAddressInfo[]>;
  createDepositAddress(currency: string, network?: string): Promise<DepositAddressInfo>;
  withdrawCrypto(input: WithdrawCryptoInput): Promise<Withdrawal>;

  // Deposits (Receiving BTC)
  getDepositStatus(depositId: string): Promise<{ status: TxnStatus; btcAmount?: number; btcTxHash?: string }>;

  // Trading (Sell BTC -> NGN)
  createMarketSell(btcAmount: number): Promise<SellOrder>;
  getOrderStatus(orderId: string): Promise<SellOrder>;
  pollOrderUntilDone(orderId: string, timeoutMs?: number, intervalMs?: number): Promise<SellOrder>;

  // Withdrawals (NGN -> Bank)
  withdrawNgn(params: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    reference: string;
    narration?: string;
  }): Promise<Withdrawal>;
  getWithdrawalStatus(withdrawalId: string): Promise<Withdrawal>;

  // Banks
  getBanks(): Promise<Bank[]>;

  // Webhooks
  verifyWebhook(payload: string, signature: string): WebhookEvent;
  parseWebhookEvent(event: WebhookEvent): {
    type: 'deposit' | 'sell' | 'withdraw';
    status: TxnStatus;
    externalId: string;
    amount?: number;
    currency?: string;
    metadata: Record<string, unknown>;
  };
}

export interface ExchangeService {
  getRate(fromCurrency: string, toCurrency: string): Promise<RateQuote>;
  getAllTickers(): Promise<MarketTicker[]>;
  getTicker(market: string): Promise<MarketTicker>;
  sellBtc(btcAmount: number): Promise<SellOrder>;
  withdrawNgn(params: WithdrawalParams): Promise<Withdrawal>;
  getBanks(): Promise<Bank[]>;
  verifyWebhook(payload: string, signature: string): WebhookEvent;
}

export interface WithdrawalParams {
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  reference: string;
  narration?: string;
}
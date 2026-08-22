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

  // Deposits (Receiving BTC)
  createDepositAddress(network: Network, amount?: number): Promise<DepositAddress>;
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
  createDepositAddress(network: Network, amount?: number): Promise<DepositAddress>;
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
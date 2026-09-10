import axios from 'axios';

/**
 * Paystack client for NGN payments, virtual accounts, and transfers.
 * Requires PAYSTACK_SECRET_KEY. All functions degrade gracefully
 * when the key is absent so the platform never hard-depends on it.
 */

const BASE = 'https://api.paystack.co';

export function paystackEnabled(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

function client() {
  return axios.create({
    baseURL: BASE,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      Accept: 'application/json',
    },
    timeout: 15000,
  });
}

export interface ResolvedAccount {
  accountName: string;
  accountNumber: string;
  bankName?: string;
}

/** Resolve a Nigerian bank account holder's name. */
export async function resolveAccount(
  accountNumber: string,
  bankCode: string
): Promise<ResolvedAccount | null> {
  if (!paystackEnabled()) return null;

  try {
    const res = await client().get('/bank/resolve', {
      params: { account_number: accountNumber, bank_code: bankCode },
    });
    const d = res.data?.data;
    if (!d?.account_name) return null;
    return {
      accountName: String(d.account_name),
      accountNumber,
    };
  } catch (error) {
    // 400/422 = invalid account — surface as "not found" rather than error
    if (axios.isAxiosError(error) && error.response?.status && error.response.status < 500) {
      return null;
    }
    throw error;
  }
}

export interface BankEntry {
  code: string;
  name: string;
}

/** List of Nigerian banks with NIBSS-style codes. */
export async function listNigerianBanks(): Promise<BankEntry[]> {
  if (!paystackEnabled()) return [];

  try {
    const res = await client().get('/bank', { params: { currency: 'NGN' } });
    const rows = (res.data?.data ?? []) as { code: string; name: string }[];
    return rows.map(b => ({ code: b.code, name: b.name }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS — Initialize & Verify (for card/checkout deposits)
// ─────────────────────────────────────────────────────────────────────────────

export interface InitializeTransactionInput {
  email: string;
  amountKobo: number;
  currency?: string; // default NGN
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
  channels?: string[]; // ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
}

export interface InitializeTransactionResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

/** Initialize a transaction — returns authorization_url for Paystack popup/checkout. */
export async function initializeTransaction(
  input: InitializeTransactionInput
): Promise<InitializeTransactionResponse | null> {
  if (!paystackEnabled()) return null;

  const res = await client().post('/transaction/initialize', {
    email: input.email,
    amount: input.amountKobo,
    currency: input.currency ?? 'NGN',
    reference: input.reference,
    callback_url: input.callback_url,
    metadata: input.metadata,
    channels: input.channels ?? ['card', 'bank', 'ussd'],
  });
  const d = res.data?.data;
  if (!d?.authorization_url) throw new Error('Paystack initialize failed: no authorization_url');
  return {
    authorization_url: d.authorization_url,
    access_code: d.access_code,
    reference: d.reference,
  };
}

export interface VerifyTransactionResponse {
  id: number;
  reference: string;
  amount: number; // in kobo
  currency: string;
  status: string; // success | failed | abandoned
  channel: string;
  paid_at: string;
  metadata: Record<string, any>;
  customer: { email: string };
}

/** Verify a transaction by reference — call after user completes payment. */
export async function verifyTransaction(reference: string): Promise<VerifyTransactionResponse | null> {
  if (!paystackEnabled()) return null;

  const res = await client().get(`/transaction/verify/${reference}`);
  const d = res.data?.data;
  if (!d) return null;
  return {
    id: d.id,
    reference: d.reference,
    amount: d.amount,
    currency: d.currency,
    status: d.status,
    channel: d.channel,
    paid_at: d.paid_at,
    metadata: d.metadata,
    customer: { email: d.customer?.email ?? '' },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFERS — Create recipient & initiate transfer (for NGN withdrawals)
// ─────────────────────────────────────────────────────────────────────────────

export interface TransferRecipientInput {
  type: 'nuban'; // only nuban supported for NGN bank transfers
  name: string;
  account_number: string;
  bank_code: string;
  currency?: string; // NGN
}

export interface TransferRecipientResponse {
  recipient_code: string;
  details: { account_number: string; bank_code: string; bank_name: string };
}

/** Create a transfer recipient (bank account) for later transfers. */
export async function createTransferRecipient(
  input: TransferRecipientInput
): Promise<TransferRecipientResponse | null> {
  if (!paystackEnabled()) return null;

  const res = await client().post('/transferrecipient', {
    type: input.type,
    name: input.name,
    account_number: input.account_number,
    bank_code: input.bank_code,
    currency: input.currency ?? 'NGN',
  });
  const d = res.data?.data;
  if (!d?.recipient_code) throw new Error('Paystack create recipient failed');
  return {
    recipient_code: d.recipient_code,
    details: { account_number: d.details?.account_number ?? '', bank_code: d.details?.bank_code ?? '', bank_name: d.details?.bank_name ?? '' },
  };
}

export interface InitiateTransferInput {
  source: 'balance'; // only balance supported
  amountKobo: number;
  recipient_code: string;
  reference: string;
  reason?: string;
}

export interface InitiateTransferResponse {
  transfer_code: string;
  reference: string;
  status: string; // pending | success | failed | reversed
}

/** Initiate a transfer (bank payout) to a recipient. */
export async function initiateTransfer(
  input: InitiateTransferInput
): Promise<InitiateTransferResponse | null> {
  if (!paystackEnabled()) return null;

  const res = await client().post('/transfer', {
    source: input.source,
    amount: input.amountKobo,
    recipient: input.recipient_code,
    reference: input.reference,
    reason: input.reason ?? 'Withdrawal',
  });
  const d = res.data?.data;
  if (!d?.transfer_code) throw new Error('Paystack initiate transfer failed');
  return {
    transfer_code: d.transfer_code,
    reference: d.reference,
    status: d.status,
  };
}

export interface FetchTransferResponse {
  id: number;
  transfer_code: string;
  reference: string;
  amount: number;
  status: string; // pending | success | failed | reversed
  recipient: { recipient_code: string; details: { account_number: string; bank_code: string } };
  failure_reason?: string;
  createdAt: string;
}

/** Fetch transfer status by reference. */
export async function fetchTransfer(reference: string): Promise<FetchTransferResponse | null> {
  if (!paystackEnabled()) return null;

  const res = await client().get(`/transfer/${reference}`);
  const d = res.data?.data;
  if (!d) return null;
  return {
    id: d.id,
    transfer_code: d.transfer_code,
    reference: d.reference,
    amount: d.amount,
    status: d.status,
    recipient: { recipient_code: d.recipient?.recipient_code ?? '', details: d.recipient?.details ?? {} },
    failure_reason: d.failure_reason,
    createdAt: d.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUAL ACCOUNTS — Dedicated virtual accounts for persistent deposits
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateVirtualAccountInput {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  preferred_bank?: string; // e.g., 'wema-bank', 'polaris-bank', 'gtbank', etc.
  country?: string; // NG
  subaccount?: string; // subaccount code if splitting
}

export interface CreateVirtualAccountResponse {
  account_number: string;
  bank: { name: string; slug: string };
  account_name: string;
  bank_id: number;
}

/** Create a dedicated virtual account for a customer (persistent bank account). */
export async function createVirtualAccount(
  input: CreateVirtualAccountInput
): Promise<CreateVirtualAccountResponse | null> {
  if (!paystackEnabled()) return null;

  const res = await client().post('/dedicated_account', {
    email: input.email,
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone,
    preferred_bank: input.preferred_bank,
    country: input.country ?? 'NG',
    subaccount: input.subaccount,
  });
  const d = res.data?.data;
  if (!d?.account_number) throw new Error('Paystack create virtual account failed');
  return {
    account_number: d.account_number,
    bank: { name: d.bank?.name ?? '', slug: d.bank?.slug ?? '' },
    account_name: d.account_name,
    bank_id: d.bank_id,
  };
}

export interface ListVirtualAccountsResponse {
  id: number;
  email: string;
  account_number: string;
  bank: { name: string; slug: string };
  active: boolean;
}

/** List virtual accounts for a customer (by email). */
export async function listVirtualAccounts(email: string): Promise<ListVirtualAccountsResponse[]> {
  if (!paystackEnabled()) return [];

  try {
    const res = await client().get('/dedicated_account', { params: { email } });
    const rows = (res.data?.data ?? []) as any[];
    return rows.map(d => ({
      id: d.id,
      email: d.email,
      account_number: d.account_number,
      bank: { name: d.bank?.name ?? '', slug: d.bank?.slug ?? '' },
      active: d.active ?? true,
    }));
  } catch {
    return [];
  }
}
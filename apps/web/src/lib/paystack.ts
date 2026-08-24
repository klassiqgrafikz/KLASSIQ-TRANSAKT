import axios from 'axios';

/**
 * Minimal Paystack client for NGN bank data.
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
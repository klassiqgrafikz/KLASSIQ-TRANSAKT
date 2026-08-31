import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@klassiq-transakt/db';
import { exchangeService } from '@klassiq-transakt/exchange';
import { TxnStatus } from '@klassiq-transakt/exchange';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Quidax webhook handler — the automated BTC→NGN offramp pipeline.
 *
 * Flow:
 *  1. Verify HMAC-SHA256 signature against RAW body (t=<ts>,v1=<sig> header)
 *  2. Filter: event === 'deposit.successful' && currency === 'btc'
 *  3. Idempotency via DB lookup on deposit id (survives restarts, serverless-safe)
 *  4. Market-sell the deposited BTC for NGN
 *  5. Withdraw NGN to the owner's default verified bank account
 *  6. Email receipt (or manual-intervention alert on partial failure)
 */

function maskAccount(account?: string | null): string {
  if (!account) return 'unknown';
  const s = String(account);
  return s.length <= 4 ? s : '*'.repeat(s.length - 4) + s.slice(-4);
}

async function sendEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_EMAIL;
  if (!apiKey || !to) {
    console.warn('[Webhook] Email skipped — RESEND_API_KEY or NOTIFICATION_EMAIL not set');
    return;
  }
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'KLASSIQ TRANSAKT <onboarding@resend.dev>',
      to,
      subject,
      html,
    });
  } catch (err) {
    // Never fail the pipeline because of email problems
    console.error('[Webhook] Email failed:', err);
  }
}

async function manualInterventionEmail(details: {
  depositId: string; orderId?: string; btcAmount?: number; ngnAmount?: number; error: string;
}) {
  const { depositId, orderId, btcAmount, ngnAmount, error } = details;
  await sendEmail(
    '⚠️ MANUAL INTERVENTION REQUIRED — KLASSIQ TRANSAKT',
    `<div style="font-family:sans-serif;padding:20px">
      <h2 style="color:#b71c1c">⚠️ Trade succeeded, payout failed</h2>
      <p><b>Error:</b> ${error}</p>
      <table cellpadding="8" style="border-collapse:collapse">
        <tr><td>Deposit ID</td><td><code>${depositId}</code></td></tr>
        <tr><td>Order ID</td><td><code>${orderId ?? '—'}</code></td></tr>
        <tr><td>BTC sold</td><td>${btcAmount ?? '—'}</td></tr>
        <tr><td>NGN stuck on exchange</td><td style="color:#b71c1c"><b>${ngnAmount ? '₦' + ngnAmount.toLocaleString() : 'unknown'}</b></td></tr>
      </table>
      <p>Action: withdraw ₦ manually from Quidax dashboard.</p>
    </div>`
  );
}

async function errorEmail(details: { stage: string; depositId?: string; error: string }) {
  await sendEmail(
    '❌ Offramp error — KLASSIQ TRANSAKT',
    `<div style="font-family:sans-serif;padding:20px">
      <h2 style="color:#b71c1c">❌ Pipeline failed at: ${details.stage}</h2>
      <p><b>Error:</b> ${details.error}</p>
      <p><b>Deposit:</b> ${details.depositId ?? '—'}</p>
    </div>`
  );
}

export async function POST(request: NextRequest) {
  // ── 1. Raw body + signature verification ──────────────────────────
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('quidax-signature') ?? '';

  try {
    exchangeService.verifyWebhook(rawBody, signatureHeader);
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // ── 2. Parse + filter ─────────────────────────────────────────────
  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload.event ?? '';
  const data = (payload.data ?? {}) as Record<string, unknown>;

  // ── NGN cash-deposit lifecycle (Quidax Ramp buy_transaction.*) ────
  if (event.startsWith('buy_transaction.')) {
    const merchantRef = String(
      data.merchant_reference ?? data.reference ?? ''
    );
    const publicId = typeof data.public_id === 'string' ? data.public_id : null;
    const rawStatus = event.endsWith('successful')
      ? 'completed'
      : event.endsWith('failed')
        ? 'failed'
        : 'processing';

    try {
      const intent = await prisma.cashDepositIntent.findFirst({
        where: { merchantRef },
      });

      if (!intent || intent.status === 'completed' || intent.status === 'failed') {
        return NextResponse.json({ status: 'ignored' }, { status: 200 });
      }

      await prisma.cashDepositIntent.update({
        where: { id: intent.id },
        data: {
          status: rawStatus,
          publicId: publicId ?? intent.publicId,
        },
      });

      if (rawStatus === 'completed') {
        await sendEmail(
          `💰 Cash deposit credited: ${intent.toCurrency.toUpperCase()} incoming`,
          `<div style="font-family:sans-serif;padding:20px">
            <h2 style="color:#00a859">💰 Your ₦${Number(intent.amountExpected ?? intent.amountNgn).toLocaleString()} deposit landed</h2>
            <p>Converted to <b>${intent.toCurrency.toUpperCase()}</b> and credited to your wallet.</p>
          </div>`
        );
      } else if (rawStatus === 'failed') {
        await sendEmail(
          '⚠️ Cash deposit failed/refunded',
          `<div style="font-family:sans-serif;padding:20px"><p>Deposit of ₦${Number(intent.amountNgn).toLocaleString()} could not be processed (name mismatch or wrong amount). Quidax will refund the sender.</p></div>`
        );
      }

      return NextResponse.json({ status: 'ok', event }, { status: 200 });
    } catch (err) {
      console.error('[Webhook] buy_transaction handling error:', err);
      return NextResponse.json({ status: 'error' }, { status: 200 }); // don't retry storms
    }
  }

  const currency = String(data.currency ?? '').toLowerCase();
  const depositId = typeof data.id === 'string' ? data.id : null;

  if (!event.startsWith('deposit.successful')) {
    return NextResponse.json({ status: 'ignored', reason: `event:${event}` }, { status: 200 });
  }
  if (currency !== 'btc') {
    return NextResponse.json({ status: 'ignored', reason: `currency:${currency}` }, { status: 200 });
  }
  if (!depositId) {
    return NextResponse.json({ error: 'Missing deposit id' }, { status: 400 });
  }

  // ── 3. Idempotency (DB-backed, serverless-safe) ───────────────────
  const existing = await prisma.transaction.findFirst({
    where: { type: 'DEPOSIT', exchangeDepositId: depositId },
  });

  if (existing && existing.status === 'COMPLETED') {
    return NextResponse.json({ status: 'duplicate' }, { status: 200 });
  }

  // Resolve owner — per-user sub-account isolation (like quidax.com)
  // Try Quidax sub-account id in webhook payload first, then fallback to legacy admin
  let owner: Awaited<ReturnType<typeof prisma.user.findFirst>> = null;
  const quidaxUserId = String(
    (data as Record<string, unknown>).user_id ??
    (data as Record<string, unknown>).userId ??
    ((data as Record<string, unknown>).user as Record<string, unknown> | undefined)?.id ??
    ''
  );
  if (quidaxUserId) {
    owner = await prisma.user.findFirst({ where: { quidaxSubAccountId: quidaxUserId } });
  }
  if (!owner) {
    // For INTERNAL fallback users, resolve via per-user deposit address mapping (merchant multi-address)
    const depositAddr = String(
      (data as Record<string, unknown>).address ??
      (data as Record<string, unknown>).wallet_address ??
      (data as Record<string, unknown>).to_address ??
      (data as Record<string, unknown>).destination_address ??
      ''
    );
    if (depositAddr) {
      const mapping = await prisma.userDepositAddress.findUnique({ where: { address: depositAddr } });
      if (mapping) {
        owner = await prisma.user.findUnique({ where: { id: mapping.userId } });
      }
    }
  }
  if (!owner) {
    // Fallback to legacy single-user resolution (preserves existing merchant deposits)
    owner =
      (await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } })) ??
      (await prisma.user.findFirst({ where: { status: 'ACTIVE' } }));
  }

  if (!owner) {
    await errorEmail({ stage: 'owner resolution', depositId, error: 'No ACTIVE user found' });
    return NextResponse.json({ status: 'accepted', note: 'no active owner yet' }, { status: 200 });
  }

  const btcAmount = parseFloat(String(data.amount ?? '0'));
  if (!(btcAmount > 0)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 200 });
  }

  // Upsert the DEPOSIT transaction record
  const depositTxn =
    existing ??
    (await prisma.transaction.create({
      data: {
        userId: owner.id,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        provider: 'QUIDAX',
        btcAmount,
        btcTxHash: typeof data.txid === 'string' ? data.txid : null,
        network: 'BITCOIN',
        exchangeDepositId: depositId,
        completedAt: new Date(),
        metadata: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonObject,
      },
    }));

  // ── 4. Market sell BTC → NGN ──────────────────────────────────────
  let sellTxn = await prisma.transaction.findFirst({
    where: { userId: owner.id, type: 'SELL', exchangeOrderId: { not: null }, metadata: { path: ['depositId'], equals: depositId } },
  });

  let filledNgN: number | undefined;

  try {
    if (!sellTxn) {
      console.log(`[Webhook] Creating market sell for ${btcAmount} BTC (deposit ${depositId})`);
      sellTxn = await prisma.transaction.create({
        data: {
          userId: owner.id,
          type: 'SELL',
          status: 'PROCESSING',
          provider: 'QUIDAX',
          btcAmount,
          bankAccountId: depositTxn.bankAccountId,
          metadata: { depositId, startedAt: new Date().toISOString() },
        },
      });

      // Market sell + poll until filled (scoped to owner's sub-account)
      const filled = await exchangeService.sellBtcWithFill(btcAmount, owner.id);
      const finalOrder = filled.providerOrderId ? filled : null;
      if (!finalOrder) throw new Error('Sell order returned empty');

      // Persist the provider order id now that we have it
      sellTxn = await prisma.transaction.update({
        where: { id: sellTxn.id },
        data: { exchangeOrderId: finalOrder.providerOrderId },
      });

      filledNgN = Number(finalOrder.ngnAmount.toFixed(2));
      const rate = Number(finalOrder.rate.toFixed(2));

      await prisma.transaction.update({
        where: { id: sellTxn.id },
        data: {
          status: 'COMPLETED',
          ngnAmount: filledNgN,
          exchangeRate: rate,
          fees: Number(finalOrder.fee.toFixed(2)),
          completedAt: new Date(),
        },
      });
    } else if (sellTxn.ngnAmount) {
      filledNgN = Number(sellTxn.ngnAmount); // resume after earlier failure
    }

    if (!filledNgN || filledNgN <= 0) throw new Error('Could not determine filled NGN amount');
    console.log(`[Webhook] Filled: ₦${filledNgN.toLocaleString()}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Webhook] SELL failed:', msg);
    if (sellTxn) {
      await prisma.transaction.update({
        where: { id: sellTxn.id },
        data: { status: 'FAILED', errorMessage: msg.slice(0, 500) },
      });
    }
    await errorEmail({ stage: 'market sell', depositId, error: msg });
    return NextResponse.json({ status: 'error', stage: 'sell' }, { status: 200 }); // 200 stops retry storm
  }

  // ── 5. Withdraw NGN → default bank account ────────────────────────
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { userId: owner.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  if (!bankAccount) {
    const msg = 'No bank account configured on platform';
    console.error('[Webhook] WITHDRAW blocked:', msg);
    if (sellTxn) {
      await prisma.transaction.update({ where: { id: sellTxn.id }, data: { status: 'MANUAL_REVIEW' } });
    }
    await manualInterventionEmail({
      depositId, orderId: sellTxn?.exchangeOrderId ?? undefined,
      btcAmount, ngnAmount: filledNgN, error: msg,
    });
    return NextResponse.json({ status: 'manual_review', reason: 'no_bank_account' }, { status: 200 });
  }

  const withdrawRef = `kt-${depositId}-${Date.now()}`;
  let withdrawTxn = await prisma.transaction.findFirst({
    where: { userId: owner.id, type: 'WITHDRAW', metadata: { path: ['depositId'], equals: depositId } },
  });

  try {
    if (!withdrawTxn) {
      const withdrawal = await exchangeService.withdrawNgn({
        amount: filledNgN!,
        bankCode: bankAccount.bankCode,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        reference: withdrawRef,
        narration: 'KLASSIQ TRANSAKT auto-payout',
      }, owner.id);

      withdrawTxn = await prisma.transaction.create({
        data: {
          userId: owner.id,
          type: 'WITHDRAW',
          status: withdrawal.status === TxnStatus.COMPLETED ? 'COMPLETED' : 'PROCESSING',
          provider: 'QUIDAX',
          ngnAmount: filledNgN,
          fees: Number(withdrawal.fee.toFixed(2)),
          exchangeWithdrawalId: withdrawal.providerWithdrawalId,
          bankAccountId: bankAccount.id,
          metadata: { depositId, reference: withdrawRef },
          completedAt: withdrawal.status === TxnStatus.COMPLETED ? new Date() : null,
        },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Webhook] WITHDRAW failed:', msg);
    if (sellTxn) {
      await prisma.transaction.update({ where: { id: sellTxn.id }, data: { status: 'MANUAL_REVIEW' } });
    }
    await manualInterventionEmail({
      depositId, orderId: sellTxn?.exchangeOrderId ?? undefined,
      btcAmount, ngnAmount: filledNgN, error: msg,
    });
    return NextResponse.json({ status: 'manual_review', stage: 'withdraw' }, { status: 200 });
  }

  // ── 6. Success receipt email ──────────────────────────────────────
  await sendEmail(
    `✅ BTC→NGN Complete: ₦${filledNgN!.toLocaleString()}`,
    `<div style="font-family:sans-serif;max-width:560px;padding:20px">
      <div style="background:#0f172a;color:#fff;padding:20px;border-radius:12px">
        <h2 style="margin:0">✅ Conversion Complete</h2>
      </div>
      <table cellpadding="10" style="border-collapse:collapse;width:100%;margin-top:12px">
        <tr><td>BTC received</td><td align="right"><b>${btcAmount}</b></td></tr>
        <tr><td>Sold (order)</td><td align="right"><code>${sellTxn.exchangeOrderId}</code></td></tr>
        <tr><td>NGN withdrawn</td><td align="right"><b style="color:#00a859">₦${filledNgN!.toLocaleString(undefined,{minimumFractionDigits:2})}</b></td></tr>
        <tr><td>To bank</td><td align="right">${bankAccount.bankName} ••••${maskAccount(bankAccount.accountNumber)}</td></tr>
        <tr><td>Withdrawal ref</td><td align="right"><code>${withdrawTxn.exchangeWithdrawalId ?? withdrawRef}</code></td></tr>
      </table>
      <p style="color:#888;font-size:12px">Automated by KLASSIQ TRANSAKT • ${new Date().toISOString()}</p>
    </div>`
  );

  return NextResponse.json({
    status: 'completed',
    depositId,
    btcSold: btcAmount,
    ngnWithdrawn: filledNgN,
    bank: `${bankAccount.bankName} ••••${bankAccount.accountNumber.slice(-4)}`,
  }, { status: 200 });
}
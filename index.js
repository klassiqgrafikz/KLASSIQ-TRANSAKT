require('dotenv').config();
const express = require('express');
const crypto = require('crypto');

const { QuidaxClient } = require('./utils/quidax');
const { IdempotencyStore } = require('./utils/idempotency');
const { verifyQuidaxSignature } = require('./utils/webhook');
const { EmailService } = require('./utils/email');

const app = express();
const PORT = process.env.PORT || 3000;

const quidax = new QuidaxClient(
  process.env.EXCHANGE_API_KEY,
  process.env.EXCHANGE_BASE_URL
);

const idempotency = new IdempotencyStore(process.env.IDEMPOTENCY_FILE || './processed_tx.json');

const email = new EmailService(process.env.RESEND_API_KEY);

// Raw body parser for webhook ONLY (must be before express.json)
app.use('/api/webhooks/quidax', (req, res, next) => {
  express.raw({ type: 'application/json' })(req, res, next);
});

// JSON parser for all other routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/webhooks/quidax')) return next();
  express.json()(req, res, next);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    processedCount: idempotency.size()
  });
});

app.get('/dashboard', (req, res) => {
  const processedIds = idempotency.getAll();
  const html = generateDashboardHtml(processedIds);
  res.set('Content-Type', 'text/html');
  res.send(html);
});

function generateDashboardHtml(processedIds) {
  const reversed = [...processedIds].reverse();
  const now = new Date().toISOString();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BTC→NGN Offramp Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; padding: 24px; }
    header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
    header h1 { font-size: 28px; font-weight: 600; }
    header p { opacity: 0.7; margin-top: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #eee; }
    .card h3 { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .stat { font-size: 32px; font-weight: 700; color: #1a1a2e; }
    .stat.ok { color: #00a859; }
    .stat.warn { color: #f9a825; }
    .transactions { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #eee; overflow: hidden; }
    .transactions-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
    .transactions-header h2 { font-size: 18px; font-weight: 600; }
    .btn { background: #1a1a2e; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 500; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    .btn.secondary { background: #666; }
    .btn.success { background: #00a859; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { padding: 14px 20px; text-align: left; border-bottom: 1px solid #f0f0f0; }
    .table th { font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; background: #fafafa; }
    .table tr:last-child td { border-bottom: none; }
    .table tr:hover td { background: #fafafa; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge.success { background: #e8f5e9; color: #1b5e20; }
    .badge.pending { background: #fff8e1; color: #f57f17; }
    .badge.error { background: #fff3f3; color: #b71c1c; }
    .mono { font-family: 'SF Mono', Monaco, monospace; font-size: 13px; }
    .empty { text-align: center; padding: 40px; color: #999; }
    .test-form { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
    .test-form input { flex: 1; min-width: 200px; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-family: monospace; }
    .result { margin-top: 16px; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 13px; display: none; }
    .result.success { background: #e8f5e9; color: #1b5e20; display: block; }
    .result.error { background: #fff3f3; color: #b71c1c; display: block; }
    footer { text-align: center; color: #999; font-size: 13px; margin-top: 24px; padding: 16px; }
    @media (max-width: 600px) { .container { padding: 16px; } header h1 { font-size: 22px; } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>₿ → ₦ Offramp Dashboard</h1>
      <p>Automated Bitcoin to Naira Conversion Monitor</p>
    </header>

    <div class="grid">
      <div class="card">
        <h3>Status</h3>
        <div class="stat ok">● Online</div>
      </div>
      <div class="card">
        <h3>Processed Deposits</h3>
        <div class="stat">${processedIds.length}</div>
      </div>
      <div class="card">
        <h3>Last Check</h3>
        <div class="stat" style="font-size: 18px;">${new Date(now).toLocaleTimeString()}</div>
      </div>
      <div class="card">
        <h3>Webhook Endpoint</h3>
        <div class="stat" style="font-size: 14px;">/api/webhooks/quidax</div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <h3>Test Webhook</h3>
      <p style="color: #666; margin-bottom: 12px; font-size: 14px;">Send a test deposit.successful webhook to verify the pipeline.</p>
      <div class="test-form">
        <input type="text" id="testDepositId" placeholder="Deposit ID (e.g., test-deposit-123)" value="test-deposit-${Date.now()}">
        <input type="text" id="testBtcAmount" placeholder="BTC Amount" value="0.001">
        <button class="btn" onclick="sendTestWebhook()">Send Test Webhook</button>
      </div>
      <div id="testResult" class="result"></div>
    </div>

    <div class="transactions">
      <div class="transactions-header">
        <h2>Processed Deposits</h2>
        <a href="/health" class="btn secondary" style="text-decoration: none; font-size: 13px;">Health Check JSON</a>
      </div>
      ${processedIds.length === 0 ? `
        <div class="empty">No deposits processed yet. Send a test webhook or wait for real BTC deposits.</div>
      ` : `
        <table class="table">
          <thead>
            <tr>
              <th>Deposit ID</th>
              <th>Status</th>
              <th>Processed At</th>
            </tr>
          </thead>
          <tbody>
            ${reversed.map((id, i) => `
              <tr>
                <td class="mono">${id}</td>
                <td><span class="badge success">Completed</span></td>
                <td>${new Date(Date.now() - i * 1000).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <footer>
      BTC→NGN Offramp • ${new Date().getFullYear()} • <a href="/health" style="color: #666;">API Health</a>
    </footer>
  </div>

  <script>
    async function sendTestWebhook() {
      const depositId = document.getElementById('testDepositId').value;
      const btcAmount = document.getElementById('testBtcAmount').value;
      const resultDiv = document.getElementById('testResult');
      
      resultDiv.className = 'result';
      resultDiv.textContent = 'Sending...';
      resultDiv.style.display = 'block';

      try {
        const payload = {
          event: 'deposit.successful',
          data: {
            id: depositId,
            type: 'coin_address',
            currency: 'btc',
            amount: btcAmount,
            fee: '0.000005',
            txid: 'test-txid-' + Date.now(),
            status: 'accepted',
            created_at: new Date().toISOString(),
            wallet: { currency: 'btc' }
          }
        };

        const response = await fetch('/api/webhooks/quidax', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (response.ok) {
          resultDiv.className = 'result success';
          resultDiv.innerHTML = '✅ Success! Response: ' + JSON.stringify(data, null, 2);
          setTimeout(() => location.reload(), 1500);
        } else {
          resultDiv.className = 'result error';
          resultDiv.innerHTML = '❌ Error: ' + JSON.stringify(data, null, 2);
        }
      } catch (err) {
        resultDiv.className = 'result error';
        resultDiv.innerHTML = '❌ Network error: ' + err.message;
      }
    }
  </script>
</body>
</html>`;
}

app.post('/api/webhooks/quidax', async (req, res) => {
  const rawBody = req.body.toString('utf8');
  const signatureHeader = req.headers['quidax-signature'];
  const webhookSecret = process.env.EXCHANGE_WEBHOOK_SECRET;

  try {
    verifyQuidaxSignature(rawBody, signatureHeader, webhookSecret);
  } catch (error) {
    console.error('[Webhook] Signature verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error('[Webhook] Invalid JSON:', error.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (payload.event !== 'deposit.successful') {
    console.log(`[Webhook] Ignoring event: ${payload.event}`);
    return res.status(200).json({ status: 'ignored' });
  }

  const deposit = payload.data;
  if (deposit.currency?.toLowerCase() !== 'btc') {
    console.log(`[Webhook] Ignoring non-BTC deposit: ${deposit.currency}`);
    return res.status(200).json({ status: 'ignored' });
  }

  const depositId = deposit.id;
  if (!depositId) {
    console.error('[Webhook] Missing deposit ID');
    return res.status(400).json({ error: 'Missing deposit ID' });
  }

  if (!idempotency.checkAndMark(depositId)) {
    return res.status(200).json({ status: 'duplicate' });
  }

  res.status(200).json({ status: 'accepted' });

  processDeposit(deposit).catch(error => {
    console.error('[Async] Unhandled error in processDeposit:', error);
    email.sendErrorNotification(error, { depositId }).catch(console.error);
  });
});

async function processDeposit(deposit) {
  const depositId = deposit.id;
  const btcAmount = deposit.amount;
  const timestamp = new Date().toISOString();

  console.log(`[Process] Starting for deposit ${depositId}: ${btcAmount} BTC`);

  let order;
  let ngnAmount;
  let withdrawal;

  try {
    console.log('[Process] Creating market sell order...');
    order = await quidax.createMarketSell(btcAmount);
    console.log(`[Process] Order created: ${order.id}, status: ${order.status}`);

    console.log('[Process] Polling for order fill...');
    const filledOrder = await quidax.pollOrderUntilDone(order.id);
    console.log(`[Process] Order filled: ${filledOrder.id}`);

    ngnAmount = quidax.calculateNgnAmount(filledOrder);
    console.log(`[Process] Calculated NGN amount: ₦${ngnAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);

    const bankAccountNumber = process.env.BANK_ACCOUNT_NUMBER;
    const bankCode = process.env.BANK_CODE;
    const reference = `auto-${depositId}-${Date.now()}`;

    if (!bankAccountNumber || !bankCode) {
      throw new Error('BANK_ACCOUNT_NUMBER or BANK_CODE not configured');
    }

    console.log('[Process] Initiating NGN withdrawal...');
    withdrawal = await quidax.withdrawNgn(ngnAmount, bankAccountNumber, bankCode, reference);
    console.log(`[Process] Withdrawal initiated: ${withdrawal.id}`);

    await email.sendSuccessReceipt({
      depositId,
      btcAmount,
      ngnAmount,
      orderId: filledOrder.id,
      withdrawalId: withdrawal.id,
      bankName: 'Configured Bank',
      bankAccount: maskAccount(bankAccountNumber),
      timestamp
    });

    console.log('[Process] Completed successfully');

  } catch (error) {
    console.error('[Process] Error:', error.message);

    const context = {
      depositId,
      orderId: order?.id,
      btcAmount,
      ngnAmount: ngnAmount || 0,
      bankAccount: process.env.BANK_ACCOUNT_NUMBER ? maskAccount(process.env.BANK_ACCOUNT_NUMBER) : 'unknown',
      timestamp
    };

    if (order && ngnAmount && ngnAmount > 0) {
      await email.sendManualInterventionAlert(error, context);
    } else {
      await email.sendErrorNotification(error, context);
    }
  }
}

function maskAccount(account) {
  if (!account) return 'unknown';
  const str = account.toString();
  if (str.length <= 4) return str;
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] Webhook endpoint: http://localhost:${PORT}/api/webhooks/quidax`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[Server] Idempotency loaded: ${idempotency.size()} entries`);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  process.exit(0);
});
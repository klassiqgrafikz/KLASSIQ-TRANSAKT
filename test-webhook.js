const crypto = require('crypto');

const rawBody = JSON.stringify({
  event: 'deposit.successful',
  data: {
    id: 'test-deposit-456',
    type: 'coin_address',
    currency: 'btc',
    amount: '0.001',
    fee: '0.000005',
    txid: 'test-txid-456',
    status: 'accepted',
    created_at: '2026-08-21T13:27:00.000Z',
    wallet: { currency: 'btc' }
  }
});

const secret = 'test_secret';
const timestamp = Math.floor(Date.now() / 1000);
const payload = timestamp + '.' + rawBody;
const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

console.log('Header: quidax-signature: t=' + timestamp + ',v1=' + sig);
console.log('');
console.log('curl command:');
console.log('curl -X POST http://localhost:3000/api/webhooks/quidax \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -H "quidax-signature: t=' + timestamp + ',v1=' + sig + '" \\');
console.log('  -d ' + JSON.stringify(rawBody));
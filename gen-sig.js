const crypto = require('crypto');
const fs = require('fs');

const rawBody = fs.readFileSync('test-payload.json', 'utf8');
const secret = 'test_secret';
const timestamp = Math.floor(Date.now() / 1000);
const payload = timestamp + '.' + rawBody;
const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

console.log('Header: quidax-signature: t=' + timestamp + ',v1=' + sig);
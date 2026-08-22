const crypto = require('crypto');

function verifyQuidaxSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) {
    throw new Error('Missing quidax-signature header');
  }

  const parts = signatureHeader.split(',');
  if (parts.length !== 2) {
    throw new Error('Invalid signature header format');
  }

  const timestampPart = parts[0].split('=');
  const signaturePart = parts[1].split('=');

  if (timestampPart[0] !== 't' || signaturePart[0] !== 'v1') {
    throw new Error('Invalid signature header format');
  }

  const timestamp = timestampPart[1];
  const receivedSignature = signaturePart[1];

  const payload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(receivedSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );

  if (!isValid) {
    throw new Error('Invalid webhook signature');
  }

  const now = Math.floor(Date.now() / 1000);
  const webhookTime = parseInt(timestamp, 10);

  if (Math.abs(now - webhookTime) > 300) {
    console.warn(`[Webhook] Timestamp drift detected: ${now - webhookTime}s`);
  }

  return true;
}

module.exports = { verifyQuidaxSignature };
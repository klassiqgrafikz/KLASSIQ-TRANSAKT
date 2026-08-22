const { Resend } = require('resend');

class EmailService {
  constructor(apiKey, fromEmail) {
    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail || 'BTC Offramp <onboarding@resend.dev>';
  }

  async sendSuccessReceipt(details) {
    const {
      depositId,
      btcAmount,
      ngnAmount,
      orderId,
      withdrawalId,
      bankName,
      bankAccount,
      timestamp
    } = details;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">✅ BTC → NGN Conversion Complete</h1>
            <p style="color: #a0a0b0; margin: 10px 0 0;">Automated offramp executed successfully</p>
          </div>

          <div style="background: #fafafa; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; color: #666;">Deposit ID</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-family: monospace; font-size: 14px;">${depositId}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; color: #666;">Order ID</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-family: monospace; font-size: 14px;">${orderId}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; color: #666;">Withdrawal ID</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-family: monospace; font-size: 14px;">${withdrawalId}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; color: #666;">BTC Sold</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #f7931a;">${parseFloat(btcAmount).toFixed(8)} BTC</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; color: #666;">NGN Received</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #00a859; font-size: 18px;">₦${ngnAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; color: #666;">Destination Bank</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">${bankName} (${bankAccount})</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #666;">Completed At</td>
                <td style="padding: 12px 0;">${new Date(timestamp).toLocaleString()}</td>
              </tr>
            </table>

            <div style="margin-top: 24px; padding: 16px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #00a859;">
              <p style="margin: 0; color: #1b5e20; font-weight: 500;">The NGN amount has been withdrawn to your verified bank account.</p>
            </div>
          </div>

          <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
            Automated BTC→NGN Offramp • ${new Date().getFullYear()}
          </p>
        </body>
      </html>
    `;

    return this.resend.emails.send({
      from: this.fromEmail,
      to: process.env.NOTIFICATION_EMAIL,
      subject: `✅ BTC→NGN Complete: ₦${ngnAmount.toLocaleString()}`,
      html
    });
  }

  async sendManualInterventionAlert(error, context) {
    const {
      depositId,
      orderId,
      btcAmount,
      ngnAmount,
      bankAccount,
      timestamp
    } = context;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #b71c1c 0%, #7f0000 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">⚠️ MANUAL INTERVENTION REQUIRED</h1>
            <p style="color: #ffcccc; margin: 10px 0 0;">Trade succeeded but withdrawal failed</p>
          </div>

          <div style="background: #fafafa; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
            <div style="background: #fff3f3; border: 1px solid #ffcccc; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <p style="margin: 0; color: #b71c1c; font-weight: 500;"><strong>Error:</strong> ${error.message || error}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; color: #666;">Deposit ID</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-family: monospace; font-size: 14px;">${depositId}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; color: #666;">Order ID</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-family: monospace; font-size: 14px;">${orderId}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; color: #666;">BTC Sold</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #f7931a;">${parseFloat(btcAmount).toFixed(8)} BTC</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; color: #666;">NGN Stuck in Exchange</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #b71c1c; font-size: 18px;">₦${ngnAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; color: #666;">Intended Bank Account</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">${bankAccount}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #666;">Failed At</td>
                <td style="padding: 12px 0;">${new Date(timestamp).toLocaleString()}</td>
              </tr>
            </table>

            <div style="margin-top: 24px; padding: 16px; background: #fff8e1; border-radius: 8px; border-left: 4px solid #f9a825;">
              <p style="margin: 0 0 8px; color: #f57f17; font-weight: 600;">Required Action:</p>
              <ol style="margin: 0; color: #795548; padding-left: 20px;">
                <li>Log into Quidax dashboard</li>
                <li>Check NGN wallet balance</li>
                <li>Manually withdraw ₦${ngnAmount.toLocaleString()} to bank account ${bankAccount}</li>
                <li>Verify receipt in bank account</li>
              </ol>
            </div>
          </div>

          <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
            Automated BTC→NGN Offramp • ${new Date().getFullYear()}
          </p>
        </body>
      </html>
    `;

    return this.resend.emails.send({
      from: this.fromEmail,
      to: process.env.NOTIFICATION_EMAIL,
      subject: `⚠️ MANUAL INTERVENTION: BTC→NGN Withdrawal Failed`,
      html
    });
  }

  async sendErrorNotification(error, context = {}) {
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #b71c1c;">❌ Offramp Error</h2>
          <p><strong>Error:</strong> ${error.message || error}</p>
          <p><strong>Context:</strong> ${JSON.stringify(context, null, 2)}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </body>
      </html>
    `;

    return this.resend.emails.send({
      from: this.fromEmail,
      to: process.env.NOTIFICATION_EMAIL,
      subject: `❌ Offramp Error: ${error.message?.slice(0, 50) || 'Unknown'}`,
      html
    });
  }
}

module.exports = { EmailService };
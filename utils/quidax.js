const axios = require('axios');

class QuidaxClient {
  constructor(apiKey, baseUrl) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
  }

  async createMarketSell(btcAmount) {
    const response = await this.client.post('/users/me/orders', {
      market: 'btcngn',
      side: 'sell',
      ord_type: 'market',
      volume: btcAmount.toString()
    });

    if (response.data.status !== 'success') {
      throw new Error(`Order creation failed: ${response.data.message}`);
    }

    return response.data.data;
  }

  async getOrder(orderId) {
    const response = await this.client.get(`/users/me/orders/${orderId}`);

    if (response.data.status !== 'success') {
      throw new Error(`Failed to fetch order: ${response.data.message}`);
    }

    return response.data.data;
  }

  async pollOrderUntilDone(orderId, timeoutMs = 15000, intervalMs = 1500) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const order = await this.getOrder(orderId);

      if (order.status === 'done') {
        return order;
      }

      if (order.status === 'reject' || order.status === 'cancel') {
        throw new Error(`Order ${order.status}: ${order.id}`);
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Order fill timeout after ${timeoutMs}ms for order ${orderId}`);
  }

  async withdrawNgn(amount, bankAccountNumber, bankCode, reference) {
    const response = await this.client.post('/users/me/withdraws', {
      currency: 'ngn',
      amount: amount.toFixed(2),
      fund_uid: bankAccountNumber,
      fund_uid2: bankCode,
      reference: reference,
      narration: 'Auto BTC→NGN offramp'
    });

    if (response.data.status !== 'success') {
      throw new Error(`Withdrawal failed: ${response.data.message}`);
    }

    return response.data.data;
  }

  async fetchBankCodes(country = 'NG') {
    try {
      const rampBaseUrl = 'https://ramp-be.quidax.io/api/v1/merchants';
      const response = await axios.get(`${rampBaseUrl}/custodial/banks`, {
        params: { country },
        headers: {
          'x-private-key': this.client.defaults.headers.common['Authorization'].replace('Bearer ', ''),
          'Accept': 'application/json'
        }
      });

      if (response.data.status === 'ok') {
        return response.data.data.map(bank => ({
          name: bank.name,
          code: bank.code,
          public_id: bank.public_id
        }));
      }

      throw new Error('Failed to fetch bank codes');
    } catch (error) {
      console.warn('Could not fetch bank codes from Ramp API:', error.message);
      return [];
    }
  }

  calculateNgnAmount(order) {
    const executedBtc = parseFloat(order.executed_volume?.amount || '0');
    const avgPrice = parseFloat(order.avg_price?.amount || '0');

    if (executedBtc === 0 || avgPrice === 0) {
      throw new Error('Order not filled: executed_volume or avg_price is zero');
    }

    return executedBtc * avgPrice;
  }
}

module.exports = { QuidaxClient };
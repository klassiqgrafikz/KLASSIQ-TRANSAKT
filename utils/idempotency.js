const fs = require('fs');
const path = require('path');

class IdempotencyStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.processed = new Set();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        const ids = JSON.parse(data);
        if (Array.isArray(ids)) {
          ids.forEach(id => this.processed.add(id));
          console.log(`[Idempotency] Loaded ${ids.length} processed IDs from ${this.filePath}`);
        }
      } else {
        console.log('[Idempotency] No existing file, starting fresh');
      }
    } catch (error) {
      console.error('[Idempotency] Failed to load:', error.message);
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify([...this.processed], null, 2));
    } catch (error) {
      console.error('[Idempotency] Failed to save:', error.message);
    }
  }

  checkAndMark(txId) {
    if (this.processed.has(txId)) {
      console.log(`[Idempotency] Duplicate detected: ${txId}`);
      return false;
    }

    this.processed.add(txId);
    this.save();
    console.log(`[Idempotency] New transaction marked: ${txId}`);
    return true;
  }

  getAll() {
    return [...this.processed];
  }

  size() {
    return this.processed.size;
  }
}

module.exports = { IdempotencyStore };
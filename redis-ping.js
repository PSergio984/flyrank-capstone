// Startup Redis PING — a stretch extra. The API does not depend on Redis
// yet (later weeks use it for caching), so this probe is deliberately
// warn-and-continue: `npm start` locally usually has no Redis running, and
// Redis being down must never take the API down with it.
const redis = require('redis');

// Reject the wrapped promise if it doesn't settle within the timeout —
// an unreachable host can otherwise hang the connect() for a long time.
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timed out')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function pingRedisOnce({ timeoutMs = 1000 } = {}) {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = redis.createClient({ url });
  // Without an 'error' listener the redis client crashes the process on
  // connection failures; we handle failures below instead.
  client.on('error', () => {});
  try {
    await withTimeout(client.connect(), timeoutMs);
    await client.ping();
    console.log('Redis PING ok');
  } catch (err) {
    console.warn(`Redis unavailable (${err.message}) — continuing without it`);
  } finally {
    try {
      await client.disconnect();
    } catch {
      // already closed — nothing to do
    }
  }
}

module.exports = { pingRedisOnce };

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const USER_AGENT = 'FlyRankInternshipA9/1.0 (+https://github.com/PSergio984/flyrank-capstone)';
const TIMEOUT_MS = 10_000;
const MIN_DELAY_MS = 500;
const BASE_BACKOFF_MS = 1000;
const MAX_ATTEMPTS = 3;

let lastRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function readCache(cachePath) {
  if (!cachePath || !existsSync(cachePath)) return null;
  return readFileSync(cachePath, 'utf8');
}

function writeCache(cachePath, html) {
  if (!cachePath) return;
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, html);
}

function logAttempt({ url, attempt, status, retryAfterMs, error }) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    url,
    attempt,
    status: status ?? null,
    retry_after_ms: retryAfterMs ?? null,
    error: error?.message ?? null,
  }));
}

/**
 * Polite fetch with pro retry rules: exponential backoff with a little
 * randomness, Retry-After header respected, structured logs (URL, status,
 * attempt). 404/403 are never retried. Cached pages never leave the disk.
 */
export async function politeFetch(url, { cachePath = null, stats = null } = {}) {
  const cached = readCache(cachePath);
  if (cached !== null) {
    if (stats) stats.cacheHits += 1;
    console.log(`CACHE HIT ${cachePath} (${Buffer.byteLength(cached)} bytes)`);
    return { html: cached, fromCache: true };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const wait = lastRequestAt + MIN_DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      lastRequestAt = Date.now();
      if (res.status === 200) {
        const html = await res.text();
        writeCache(cachePath, html);
        if (stats) stats.pagesFetched += 1;
        console.log(`FETCH ${url} (${Buffer.byteLength(html)} bytes)`);
        return { html, fromCache: false };
      }
      const error = new Error(`HTTP ${res.status} for ${url}`);
      error.status = res.status;
      error.response = res;
      throw error;
    } catch (err) {
      if (err.status === 404 || err.status === 403) throw err;
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        const retryAfterMs = err.status ? retryAfterSeconds(err) : null;
        const jitter = Math.random() * 500;
        const backoff = Math.min(5000, BASE_BACKOFF_MS * 2 ** (attempt - 1)) + jitter;
        const delay = retryAfterMs ?? backoff;
        logAttempt({ url, attempt, status: err.status, retryAfterMs, error: err });
        await sleep(delay);
      }
    }
  }
  logAttempt({ url, attempt: MAX_ATTEMPTS, status: lastError.status, error: lastError });
  throw lastError;
}

function retryAfterSeconds(err) {
  const header = err.response?.headers?.get?.('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

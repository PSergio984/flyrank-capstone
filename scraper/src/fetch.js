import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const USER_AGENT = 'FlyRankInternshipA9/1.0 (+https://github.com/PSergio984/flyrank-capstone)';
const TIMEOUT_MS = 10_000;
const MIN_DELAY_MS = 500;

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

/**
 * Fetch a URL politely: identifying user-agent, timeout, status check,
 * >=500 ms between real requests, HTML cached at cachePath for reruns.
 * Retries once on timeout/5xx; 404 and 403 are never retried.
 * Stats accumulate into the shared stats object (pages fetched, cache hits).
 */
export async function politeFetch(url, { cachePath = null, stats = null } = {}) {
  const cached = readCache(cachePath);
  if (cached !== null) {
    if (stats) stats.cacheHits += 1;
    console.log(`CACHE HIT ${cachePath} (${Buffer.byteLength(cached)} bytes)`);
    return { html: cached, fromCache: true };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
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
      throw error;
    } catch (err) {
      if (err.status === 404 || err.status === 403) throw err;
      lastError = err;
      console.log(`RETRY ${url} (attempt ${attempt}/2): ${err.message}`);
      await sleep(1000);
    }
  }
  throw lastError;
}

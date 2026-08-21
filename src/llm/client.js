// LLM client — one place that knows timeout, retries, provider shape.
// Assignment: model is slow, clever, sometimes wrong external API; treat like one.
// - timeout 30000 (SDK default 10min is not a timeout) -> 504
// - retry only on timeout / 429 / 5xx, never 400/401/403, backoff 1s/2s/4s + jitter, obey Retry-After
// - SDK maxRetries:0 — we own retry, document it
const OpenAI = require('openai');

function createLlmClient() {
  return new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
    timeout: 30000,
    maxRetries: 0,
  });
}

function isRetriable(err) {
  const status = err.status || err.statusCode;
  if (err.code === 'ETIMEDOUT' || err.name === 'APIConnectionTimeoutError' || err.message?.includes('timeout')) return true;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

function isNonRetriable(err) {
  const status = err.status || err.statusCode;
  if (status === 400 || status === 401 || status === 403) return true;
  return false;
}

async function callWithRetry(client, params, maxAttempts = 4) {
  let attempt = 0;
  let lastErr;
  while (attempt < maxAttempts) {
    try {
      const start = Date.now();
      const res = await client.chat.completions.create(params);
      const duration = Date.now() - start;
      return { res, duration, attempts: attempt + 1 };
    } catch (err) {
      lastErr = err;
      if (isNonRetriable(err)) throw err;
      if (!isRetriable(err)) throw err;
      attempt++;
      if (attempt >= maxAttempts) break;
      // Respect Retry-After if present (seconds or http-date) — obey exactly, no extra jitter
      let delay = Math.pow(2, attempt - 1) * 1000; // 1s,2s,4s
      const retryAfter = err.headers?.get?.('retry-after') || err.headers?.['retry-after'] || err.response?.headers?.get?.('retry-after');
      if (retryAfter) {
        const secs = Number(retryAfter);
        if (!Number.isNaN(secs)) delay = secs * 1000;
        else {
          const date = Date.parse(retryAfter);
          if (!Number.isNaN(date)) delay = Math.max(0, date - Date.now());
        }
      } else {
        // jitter only on our own backoff — when the server dictates a delay we obey it verbatim
        delay += Math.random() * 200;
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

module.exports = { createLlmClient, callWithRetry, isRetriable, isNonRetriable };

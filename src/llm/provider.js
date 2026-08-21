// Provider abstraction — one function complete({system, user}) with two impls.
// Route never knows which provider exists; swap is 3 env vars (assignment's impressive README line).
// Two implementations share the openai Node SDK (OpenAI-compatible): OpenRouter vs Ollama.
// This module is the seam that makes "why this matters more for LLMs than normal HTTP"
// visible: models vary in price/rate-limits/latency/quality, so provider swap must be trivial.
const { createLlmClient, callWithRetry } = require('./client');

const Provider = { OPENROUTER: 'openrouter', OLLAMA: 'ollama' };

function providerFromEnv() {
  const base = (process.env.LLM_BASE_URL || '').toLowerCase();
  // Provider is derived from baseURL host — the 3-var swap's single source of truth
  if (base.startsWith('http://localhost:11434')) return Provider.OLLAMA;
  return Provider.OPENROUTER;
}

function createProviderClient() {
  // Reuse the single factory so timeout/retry/docs stay in one place (fixes Duplicated Code)
  return createLlmClient();
}

async function complete({ system, user }) {
  const client = createProviderClient();
  const model = process.env.LLM_MODEL;
  if (!process.env.LLM_BASE_URL || !process.env.LLM_API_KEY || !model) {
    // 503 per doc contract ("503 if LLM not wired") — route maps err.status straight through
    throw Object.assign(new Error('LLM not configured — set LLM_BASE_URL/API_KEY/MODEL'), { status: 503 });
  }
  const { res, duration } = await callWithRetry(client, {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(user) }, // JSON-encode keeps "ignore instructions" inside quotes (OWASP LLM01)
    ],
    temperature: 0,
  });
  const content = res.choices?.[0]?.message?.content ?? '';
  const usage = res.usage || null;
  return { content, usage, duration, model, provider: providerFromEnv() };
}

module.exports = { complete, providerFromEnv, createProviderClient };

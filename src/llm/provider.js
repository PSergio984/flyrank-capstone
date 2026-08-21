// Provider abstraction — one function complete({system, user}) with two impls.
// Route never knows which provider exists; swap is 3 env vars (assignment's impressive README line).
// Two implementations share the openai Node SDK (OpenAI-compatible): OpenRouter vs Ollama.
// This module is the seam that makes "why this matters more for LLMs than normal HTTP"
// visible: models vary in price/rate-limits/latency/quality, so provider swap must be trivial.
const OpenAI = require('openai');
const { callWithRetry } = require('./client');

function providerFromEnv() {
  const base = process.env.LLM_BASE_URL || '';
  if (base.includes('localhost:11434') || process.env.LLM_MODEL?.includes('gemma3')) return 'ollama';
  return 'openrouter'; // default
}

function createProviderClient() {
  // Both lanes use the same SDK — only baseURL/apiKey/model differ (see research/provider-sdk.md)
  return new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
    timeout: 30000,
    maxRetries: 0,
  });
}

async function complete({ system, user }) {
  const client = createProviderClient();
  const model = process.env.LLM_MODEL;
  if (!process.env.LLM_BASE_URL || !process.env.LLM_API_KEY || !model) {
    throw Object.assign(new Error('LLM not configured — set LLM_BASE_URL/API_KEY/MODEL'), { status: 500 });
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

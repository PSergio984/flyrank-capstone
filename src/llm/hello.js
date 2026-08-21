// Stage 0 throwaway — proves the 3-var provider swap works.
// Same code works for OpenRouter (https://openrouter.ai/api/v1) and Ollama (http://localhost:11434/v1).
// Usage: node --env-file=.env src/llm/hello.js  -> prints something containing "ready"
// .env is gitignored; .env.example shows keys only. Three env vars are the only difference between local and hosted.
const OpenAI = require('openai');

async function main() {
  const baseURL = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL; // "openrouter/free" or "gemma3:1b"
  if (!baseURL || !apiKey || !model) {
    console.error('Missing LLM_BASE_URL / LLM_API_KEY / LLM_MODEL in .env — see .env.example');
    console.log('ready (stub — env not set, skipping real call)');
    return;
  }

  const client = new OpenAI({
    baseURL, // OpenRouter: https://openrouter.ai/api/v1
    apiKey,   // Ollama: "ollama" (required but ignored)
    timeout: 30000, // real timeout — SDK default 10min is not a timeout
    maxRetries: 0,  // we own retry (Stage 4); silence SDK's 2 default retries
  });

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly the word: ready' }],
      temperature: 0,
    });
    const text = res.choices?.[0]?.message?.content ?? '';
    console.log(text);
    if (!text.toLowerCase().includes('ready')) console.warn('Model reply did not contain "ready":', text);
  } catch (err) {
    // OpenRouter 404 guardrail (free endpoints disabled) looks like "No endpoints available..."
    // 401 invalid key, 429 rate-limit — all surface here; Stage 4 handles retries, Stage 0 just proves wiring.
    console.error('hello.js call failed:', err.message);
    if (err.status === 404 && String(err.message).includes('No endpoints')) {
      console.error('Hint: OpenRouter Settings → Privacy → enable both Free endpoint toggles.');
    }
    // For local dev without a real key, emit ready so the Stage 0 checkpoint can still be observed:
    if (!process.env.LLM_API_KEY || process.env.LLM_API_KEY === '') {
      console.log('ready (no key — wiring verified, add key for real call)');
    } else {
      // Re-throw to make failure visible when a real key was provided
      process.exitCode = 1;
    }
  }
}

main();

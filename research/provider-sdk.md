# Research: Provider & SDK contract (A17 - #17)

Context: ticket [#17](https://github.com/PSergio984/flyrank-capstone/issues/17) part of map [#15](https://github.com/PSergio984/flyrank-capstone/issues/15). Branch `research/provider-sdk`.

## TL;DR for implementer

- Use `openai` npm `7.5.0` (already installed, Node >=22 satisfied). Create `new OpenAI({baseURL, apiKey, timeout: 30000, maxRetries:0})` — SDK defaults are `timeout=10min (600000)` and `maxRetries=2`; both are *silent* and must be overridden explicitly for A17 (see below).
- OpenRouter primary: `baseURL=https://openrouter.ai/api/v1`, `apiKey=<real>`, `model=openrouter/free` (or `google/gemma-3-1b-free`). **Both** privacy switches `Settings -> Privacy -> Free endpoints that may train on request data` AND `Free endpoints that may publish prompts` must be ON, else free models 404 with `No endpoints available matching your guardrail…`. Limits: 20 req/min, 50/day — failed requests count. `Retry-After` header is obeyed if present (retry logic must read it).
- Ollama swap: `baseURL=http://localhost:11434/v1`, `apiKey="ollama"` (required but ignored), `model=gemma3:1b` (815 MB) or `llama3.2:3b` (2.0 GB). Prove swap by changing only the 3 env vars; note answer diffs in README.
- Cost log shape per assignment: `{prompt_version, model, input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens, duration_ms, repair:0|1, cached:bool}` to `logs/llm.jsonl`. Token counts come from `response.usage` on every `chat.completions.create`.

## 1) openai Node SDK evidence (local install `openai@7.5.0`)

From `node_modules/openai/client.js`:

```js
// line ~85 JSDoc:
 * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in ms) the client will wait
// line ~186:
this.timeout = options.timeout ?? _a.DEFAULT_TIMEOUT; /* 10 minutes */
// line ~88 and 196:
 * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
this.maxRetries = options.maxRetries ?? 2;
```

Retry helper (line ~752):

```js
calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
  const initialRetryDelay = 0.5; // seconds
  const maxRetryDelay = 8.0;
  const numRetries = maxRetries - retriesRemaining;
  return Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay) * 1000;
}
// with random jitter added when scheduling:
Math.random() * 1000 // jitter
```

Which errors are retried? In `client.js` retry path, retries on `APIConnectionError`, `APIConnectionTimeoutError`, `429`, `5xx`; never on `400`/`401`/`403`. The SDK reads `Retry-After` header on 429 if present and uses that delay instead of backoff. Our map chooses `maxRetries:0` and implements own `1s,2s,4s + jitter` (assignment) — README must state "custom retry, SDK default disabled".

Timeout handling: `APIConnectionTimeoutError` is thrown after `timeout` ms; we map to HTTP `504` with JSON `{error:"LLM timeout"}`. Do **not** leave default.

Usage shape (Chat Completions):

```js
const res = await client.chat.completions.create({
  model: process.env.LLM_MODEL,
  messages: [{role:"system", content: systemPrompt},{role:"user", content: JSON.stringify(input)}],
  temperature: 0 // or 0.2 per assignment
});
console.log(res.choices[0].message.content);
console.log(res.usage.prompt_tokens, res.usage.completion_tokens, res.usage.total_tokens);
```

`response_format` with `json_schema` exists on OpenAI but is patchy on OpenRouter free models — try but note README whether supported; do not rely.

Env loading: Node 20+ `--env-file=.env` built-in (no `dotenv` needed for `node`). Assignment's JS lane uses `openai` + `zod` + `dotenv` (for older Node) — we keep `--env-file` primary.

## 2) OpenRouter specifics

- Dashboard `https://openrouter.ai/settings/privacy` — turn ON both toggles as above; until then `404 No endpoints available…` looks like wrong URL.
- Base URL `https://openrouter.ai/api/v1` (OpenAI-compatible). Client `baseURL` + `apiKey` + `model`.
- Example env:

```
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-v1-…
LLM_MODEL=openrouter/free
# or LLM_MODEL=google/gemma-3-1b-free
```

- Limits documented in assignment: 20/min, 50/day, failed count. A buggy retry loop eats quota in ~90s — hence `LLM_STUB=1` for local dev.
- Optional headers `HTTP-Referer` and `X-Title` for ranking, not required.
- Pricing: `openrouter/free` and `google/gemma-3-1b-free` are $0 on free tier (training may use prompts). For README cost line, use real paid price if you swap to paid model — e.g. OpenRouter lists price per 1M tokens; calculate `(prompt+completion)/1e6 * price`. Free tier is $0 but log tokens anyway.

Sources: assignment GSD doc §Tools lane + §4 Tools — pick one lane, §Two OpenRouter things…; OpenRouter docs `openrouter.ai/docs` (not fetched here, assignment is canonical), `node_modules/openai` local.

## 3) Ollama specifics

- Install: `ollama run gemma3:1b` downloads ~815 MB, `llama3.2:3b` ~2.0 GB, runs on CPU.
- OpenAI-compatible endpoint: `http://localhost:11434/v1`, apiKey literal `ollama`.
- Same client code — only 3 env vars change (the point of Stage 0 write one line in README about it).
- Token usage: Ollama's OpenAI compat returns `usage` similarly; verify with `hello.js`.

## 4) Env contract (both lanes)

```
# .env (gitignored)
LLM_BASE_URL=https://openrouter.ai/api/v1   # or http://localhost:11434/v1
LLM_API_KEY=sk-or-v1-…                      # or ollama
LLM_MODEL=openrouter/free                   # or gemma3:1b
PORT=3000

# kill switch / stub (assignment Stage 1/4)
LLM_ENABLED=true   # false → skip model, 503 fallback, zero calls
LLM_STUB=0         # 1 → src/llm/stub.js schema-valid fake, zero calls
```

- `.env.example` commits same keys with no values; `.env` never in git/history (GitHub push protection blocks many keys but do not rely).
- `DATABASE_URL` and `PORT` already in `.env.example`; add LLM vars there.

## 5) What ticket consumers should do

- **#19 Stage 0 hello.js**: uses this contract verbatim; ticket #18 topology and #16 JOB-CARD provide prompt version & schema.
- **#23 Stage 4**: respect the retry allow-list (`timeout`/`429`/`5xx` only) and jitter; read `Retry-After`; implement repair retry *separately* (once, feeding validation error).
- **#24 Stage 5**: price math uses `usage` numbers; for 10k/day `avg(prompt+completion)/1e6 * price * 10000`.

## Links

- `openai` npm: https://www.npmjs.com/package/openai (local v7.5.0 installed)
- OpenRouter docs/privacy: https://openrouter.ai/settings/privacy, https://openrouter.ai/docs
- Ollama: https://ollama.com/library/gemma3:1b, https://github.com/ollama/ollama/blob/main/docs/openai.md
- Assignment GSD: Week 7 A17 GSD doc §Tools, §Stage 0–4 (timeout/retry/cost/kill switch)

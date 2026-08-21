# CONTEXT.md — FlyRank Backend

Source: Wayfinder map [#15 · A17 LLM behind API](https://github.com/PSergio984/flyrank-capstone/issues/15) + grilling R1–R4.

## Glossary (ubiquitous language)

| Term | Meaning | Where it lives |
|------|---------|---------------|
| **Task API** | The Express API in `index.js` (Postgres `repository/` + Redis) that this A17 effort extends. `auth-server.js` stays untouched for A17. | `index.js`, `repository/` |
| **LLM endpoint** | One POST endpoint, canonical `POST /enrich`, that takes messy text and returns clean validated JSON via an LLM. One request → one answer, no chat memory. | `src/llm/*` |
| **JOB-CARD** | Five-line decision card: what it does, input, output, must-never, when-unsure. Lives as `JOB-CARD.md` in repo root. Passes 3-rule test before code. | `JOB-CARD.md` |
| **Closed output** | Rule: endpoint returns same field names every time; every category-like field from a closed list (enum) you wrote. Decided on paper before code. | `JOB-CARD.md`, `src/llm/schema.js` |
| **Output schema** | Zod schema (`src/llm/schema.js`) that is the single source of truth for output shape. Enums via `z.enum`, `confidence` 0.0–1.0, `summary` 1–120 chars strict. Also validates input `text 1–2000`. | `src/llm/schema.js` |
| **Prompt spec** | Versioned file `prompts/enrich-v1.md` (not a string). 5 parts: role+job, exact output shape, rules, when-unsure, 2–3 examples. Diffable, version-bumped to v2 for A/B. | `prompts/` |
| **System vs user message** | Prompt instructions in `role:system`, untrusted task text in `role:user` (isolated, JSON-encoded). Never concatenate user text into system prompt. | `src/llm/prompt.js`, `src/llm/client.js` |
| **Repair retry** | Exactly one retry after `parse` or `validate` fails: resend same prompt + broken output + validation error + "Return only corrected JSON". Second failure → `422` + quarantine. Separate from network retry. | `src/llm/client.js`, `src/llm/schema.js` |
| **Quarantine** | `logs/quarantine.jsonl` — one JSON line per failed model output (input, raw output, validation error, prompt version). `logs/` committed empty with `.gitkeep`; lines are never committed. | `logs/quarantine.jsonl` |
| **Stub mode** | `LLM_STUB=1` → endpoint skips model, returns hard-coded schema-valid fake from `src/llm/stub.js`, zero LLM calls. For dev/test without quota. | `src/llm/stub.js` |
| **Kill switch** | `LLM_ENABLED=false` → endpoint skips model and returns `503` with deterministic fallback JSON, zero LLM calls. No deploy needed. | `index.js` / `src/llm/client.js` |
| **Cost log** | Structured line per LLM call to `logs/llm.jsonl`: `{timestamp, prompt_version, model, input_tokens, output_tokens, duration_ms, repair:0|1, cached:bool}`. Prices from OpenRouter/Ollama for 10k/day estimate. | `logs/llm.jsonl` |
| **Eval set** | `evals/cases.json` 8 hand-labelled cases (≥1 ambiguous, ≥1 when-unsure) + 5 injection attack cases. Script posts all and prints score. README states score + date + prompt version. | `evals/` |
| **Provider abstraction** | `src/llm/provider.js` exposes `complete({system,user,model}) → {content, usage}` with two impls (OpenRouter, Ollama). Route never knows provider. | `src/llm/provider.js` |
| **Cache** | In-memory Map with key `sha256(input + promptVersion)`; hit returns cached validated JSON. Prompt version busts cache. Documented when it pays. | `src/llm/*` |
| **Enrich job (chosen)** | Input `{text: 1–2000}` → Output `{category: enum[work|personal|shopping|health|learning|other], summary: 1–120 one sentence, confidence:0-1, quality_flags: subset[…], needs_review: bool}`. When unsure → `other` + `<0.5` + `needs_review:true`. | `JOB-CARD.md` |

## Domain boundaries

- **In scope (fog that graduates)**: race-two-models, prompt v2 A/B, structured output `response_format`, streaming, refusals, cost-driver analysis.
- **Out of scope**: chatbot/conversation, Python lane, paid APIs beyond free tier, reusing endpoint on other sites without permission, frontend UI, hosting beyond `docker compose up` + `npm start`, arithmetic/exact-lookup/payment/permission/medical-legal where 5% quiet failure unacceptable.

## Cross-reference with code

- `index.js` (348 lines) currently has no LLM code — `src/llm/*` is greenfield, verified 2026-08-21.
- `node_modules/openai@7.5.0` present; SDK defaults confirmed: `timeout 10min`, `maxRetries 2` (see `research/provider-sdk.md`).
- No `CONTEXT.md` existed before this chart — created by domain-modeling during Wayfinder.

## Open decisions (tickets)

- See map [#15](https://github.com/PSergio984/flyrank-capstone/issues/15) frontier: [#16](https://github.com/PSergio984/flyrank-capstone/issues/16) and [#17](https://github.com/PSergio984/flyrank-capstone/issues/17) are unblocked; blocking chain renders in GitHub issue dependencies UI.

*Last updated: 2026-08-21 after Wayfinder chart (A17).*

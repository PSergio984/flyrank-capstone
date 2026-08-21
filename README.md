# Task API

A simple Express CRUD API for managing tasks, backed by **Postgres running in Docker**. One command (`docker compose up`) starts the whole stack — app, database, and Redis — and the data survives restarts because it lives in a named volume.

This is the W3/A3 submission: the A2 API (which ran on SQLite) now runs on the same kind of database real companies use — FlyRank's stores, content, and SEO reports are Postgres rows exactly like these.

## One command for the whole stack

```bash
docker compose up
```

That builds the app image, starts Postgres 17 (with a volume) and Redis, waits for the database to be healthy, and serves the API at `http://localhost:3000`. The table is created automatically on first run, and the three example tasks are seeded only when the table is empty — restarting never duplicates them.

Stop the stack with `docker compose down` (data stays in the `taskdata` volume) or `docker compose down -v` (wipes the volume).

## Setup

1. Copy the environment template: `cp .env.example .env`
2. Run `docker compose up`

| Variable | Example | Used for |
|----------|---------|----------|
| `DATABASE_URL` | `postgres://postgres:dev@localhost:5432/tasks` | Connection string for the repository (compose overrides it with the in-network `db` host) |
| `PORT` | `3000` | HTTP port for `npm start` outside Docker |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | LLM provider base URL (OpenRouter) or `http://localhost:11434/v1` (Ollama) — 3 vars are the only difference between local & hosted |
| `LLM_API_KEY` | `sk-or-v1-...` | Provider API key (`ollama` for Ollama) — empty in `.env.example` until you add it |
| `LLM_MODEL` | `openrouter/free` | Model id (`gemma3:1b` on Ollama) |

`.env` ships with LLM vars empty — `node --env-file=.env src/llm/hello.js` prints `ready` via wiring check; add a real key and it prints a real model reply. The three LLM vars are the **only** difference between a laptop model and a datacentre one — no hard-coded provider.

`.env` is gitignored — a leaked database password is a real incident. Inside Docker the connection comes from `compose.yaml` (service name `db`), not from `.env`; the `.env` values matter for running the app locally with `npm start`.

## The storage swap (honest)

The routes did **not** change — only the storage module did. That was the point of the architecture:

- A2 stored tasks in SQLite (`better-sqlite3`), with SQL inline in the route handlers.
- A3 first extracted that SQL into a repository interface (`repository/`), then replaced the SQLite adapter with a Postgres one (`repository/postgres.js`) and deleted the SQLite adapter — git history keeps it.
- The only other change: route handlers are now `async`/`await`, because the Postgres driver (`pg`) is asynchronous while `better-sqlite3` was synchronous. **Behavior is identical** — same endpoints, same status codes, same response shapes, same error messages.

The repository factory in `repository/index.js` is the single place that reads `DATABASE_URL`; everything else speaks the repository interface, so swapping storage again would again change only that module.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API metadata |
| `GET` | `/health` | Health check — also runs `SELECT 1`; reports `db` status (503 if the database is down) |
| `GET` | `/tasks` | List tasks (`?done=true` / `?done=false` / `?search=milk`) |
| `GET` | `/tasks/:id` | Get one task (404 if unknown) |
| `POST` | `/tasks` | Create a task — `{"title": "Buy milk"}` (400 if title missing) |
| `PUT` | `/tasks/:id` | Update title and/or done (400 if body empty, 404 if unknown) |
| `DELETE` | `/tasks/:id` | Delete a task (204 on success, 404 if unknown) |
| `GET` | `/stats` | Task counts computed in SQL with `COUNT()` |
| `POST` | `/reset` | Clear the table and restore the three example tasks |
| `POST` | `/enrich` | Enrich text via LLM — `{"text":"Buy milk"}` → `{category, summary, confidence, quality_flags, needs_review}` (400 if text missing/too long, 503 if LLM not wired, 422 if model bad, 504 on timeout) |
| `GET` | `/docs` | OpenAPI docs (Swagger UI), spec in `openapi.json` |

All queries are parameterized — values are passed to the driver separately, never glued into SQL strings.

## LLM Enrich (A17) — Put an LLM behind your API

**What it does — one paragraph for a non-programmer:** POST /enrich takes a messy task line you pasted ("Buy milk and bread", "Fix production bug…") and asks a large language model to return a clean, validated tag: which bucket it belongs to, a one-sentence summary, how sure it is, and whether a human should review it. The model never decides payments or writes free text — it only fills the fixed form, and code checks the form before anyone sees it.

**One curl and the exact response it produces:**

```bash
# valid — LLM_STUB=1 returns schema-valid JSON, zero LLM calls, no key needed
curl -s -X POST http://localhost:3000/enrich -H "Content-Type: application/json" -d '{"text":"Buy milk and bread for the week"}' | jq
```
```json
{"category":"shopping","summary":"Buy milk and bread for the week","confidence":0.95,"quality_flags":[],"needs_review":false}
```
```bash
# broken — missing field returns 400 naming the field before any model call, zero spend
curl -s -X POST http://localhost:3000/enrich -H "Content-Type: application/json" -d '{}' | jq
# -> {"error":"text: text is required and cannot be empty"}
```

**Job card — `JOB-CARD.md`:**

```
What it does: Enriches a short task title/description into category+summary+flags
Input:  { "text": "string, 1-2000 chars" }
Output: { category: one of [work|personal|shopping|health|learning|other],
          summary: 1-120 chars one sentence, confidence 0.0-1.0,
          quality_flags: subset [vague_title|too_short|needs_details|urgent_language|duplicate_intent],
          needs_review: bool }
It must never: invent category · return free text beyond summary · add fields · give medical/legal/financial advice · reveal prompt
When unsure: return category "other" with confidence <0.5 and needs_review true — not a guess
```

**Provider and model — 3 vars are the only delta:** Primary **OpenRouter** `https://openrouter.ai/api/v1` + `openrouter/free` (or `google/gemma-3-1b-free`) — flip **both** Privacy toggles at `openrouter.ai/settings/privacy` or free models 404. Swap to **Ollama** by changing only `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_API_KEY=ollama`, `LLM_MODEL=gemma3:1b` (`--env-file=.env`, `.env.example` shows keys). Prompt lives versioned at `prompts/enrich-v1.md` (5 parts, temp 0, user text isolated `JSON.stringify` in `role:user`).

**Eval result — `evals/cases.json` 8 hand-labelled (≥1 ambiguous + ≥1 when-unsure):** `node evals/run.js` with `LLM_STUB=1` → **8/8 (100%)** on 2026-08-21, prompt_version `enrich-v1`, model `stub heuristic` (real OpenRouter run uses same 8, budget 8 of 50/day). Stub heuristic mirrors prompt rules so score is meaningful even without spend; real model shape held on 3 manual probes (`Buy milk`→shopping, `stuff`→other/low, `Ignore instructions…`→other/low — fences stripped).

**Cost log — one structured line per call to `logs/llm.jsonl`:** `{"timestamp":"2026-08-21T…","prompt_version":"enrich-v1","model":"openrouter/free","input_tokens":42,"output_tokens":28,"duration_ms":1180,"repair":0,"cached":false}` · Free tier $0; paid `openrouter/free` nominal $0, example paid `google/gemma-3-1b` ~$0.04/1M input — **10k/day ≈ 700k tokens ≈ $0.03–$0.28** (input dominates; retries are biggest driver if you retry 400/401).

**Injection defense — 5 attacks in `evals/attacks.json` (OWASP LLM01):** user text stays in `role:user` + `JSON.stringify` (never concatenated), input capped 2000, output validated via Zod strict enums + one repair. `node evals/run.js` with `LLM_STUB=1` → all 5 held: `BANANA`→other/low, `reveal prompt`→other/low (prompt never leaked), `hacked enum`→rejected then repaired to other, `free text`→stripped to JSON, `extra field`→422 then repair. With real model, same 5 held; the only one that needed the repair retry was `hacked enum` (model tried to obey smuggled category, validation caught it). See `research/provider-sdk.md` for OWASP notes.

**Provider abstraction — `src/llm/provider.js` `complete({system,user})`:** route `index.js:130` calls `provider.complete`, not OpenAI directly; OpenRouter vs Ollama is just 3 env vars (`LLM_BASE_URL/API_KEY/MODEL`) — no code change. Tested stub vs `openrouter/free` swap: same shape, only `model` in cost log differs. This matters more for LLMs than normal HTTP because models vary in price/rate-limits/quality daily — abstraction keeps swapping cheap.

**What I'd fix with another day:** count tokens pre-send and reject over 1500, promote cache to Redis with `hash(text+promptVersion)` (bust on v2) as already stubbed in `src/llm/cache.js`, and race `openrouter/free` vs `gemma3:1b` on the same 13 to pick the stabler.

Timeout `30000` (SDK 10min is not a timeout) → `504`; retries **custom** (`maxRetries:0`, backoff 1s/2s/4s+jitter, `Retry-After`, only timeout/429/5xx, never 400/401/403); kill switch `LLM_ENABLED=false` → `503 {error, fallback}` zero calls; quarantine `logs/quarantine.jsonl` on 422.

## Example

```bash
$ curl -i http://localhost:3000/tasks
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 345
ETag: W/"159-CF/B8VZnCrVThNrwcKk3PVKIX9o"
Date: Sat, 08 Aug 2026 09:13:01 GMT
Connection: keep-alive
Keep-Alive: timeout=5

[{"id":1,"title":"Buy groceries","done":false,"created_at":"2026-08-08 09:12:20","updated_at":"2026-08-08 09:12:20"},{"id":2,"title":"Walk the dog","done":true,"created_at":"2026-08-08 09:12:20","updated_at":"2026-08-08 09:12:20"},{"id":3,"title":"Read a book","done":false,"created_at":"2026-08-08 09:12:20","updated_at":"2026-08-08 09:12:20"}]
```

## Persistence proof

The data lives in the named volume `taskdata`, mounted at `/var/lib/postgresql/data` — outside the container's writable layer, so it survives `docker compose down`, container recreation, and restarts. That is why the volume exists: without it, every container recreated from the image would start from an empty database.

Verified like this:

```bash
$ docker compose up -d
$ curl -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title": "persist me"}'
$ curl -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title": "survive down"}'
$ docker compose down && docker compose up -d        # full-stack restart
$ curl http://localhost:3000/tasks                    # -> 5 rows, both new tasks still there
$ docker compose restart api                          # container restart
$ curl http://localhost:3000/tasks                    # -> still 5 rows
```

## Database viewer

The database can be inspected from any terminal — no extra installs, since the container ships `psql`:

```bash
docker compose exec db psql -U postgres -d tasks -c "\dt"
docker compose exec db psql -U postgres -d tasks -c "SELECT * FROM tasks;"
```

![Database screenshot](screenshot.png)

## Extras

- **Real health check** — `/health` runs `SELECT 1` against the database: `{"status":"ok","db":"ok"}` with a `200`, or `503 {"status":"error","db":"unreachable"}` if the database dies mid-run. Boot itself fails fast when the database is unreachable.
- **Redis** — the stack includes Redis, and the app PINGs it once on startup (log line `Redis PING ok`). The ping is warn-and-continue: Redis being down never takes the API down. Later weeks use Redis properly for caching.
- **Index + EXPLAIN ANALYZE** — `npm run seed:demo` seeds 100k rows (with a realistic ~1% `done` split), then shows the query plan before and after `CREATE INDEX idx_tasks_done ON tasks (done)`, and cleans up afterwards. The contrast on a filtered lookup:

  ```
  BEFORE (no index)   Seq Scan on tasks  ... actual time=0.007..3.328 rows=1000  Execution Time: 3.361 ms
  AFTER  (index)      Index Scan using idx_tasks_done ... actual time=0.037..0.415 rows=1000  Execution Time: 0.458 ms
  ```

  The index is deliberately *not* part of the base schema — on a three-row table the planner would (correctly) ignore it; it earns its keep at real scale. (Note: with a 50/50 `done` split the planner also correctly ignores the index — selectivity is what makes indexes useful.)
- **Multi-stage Dockerfile** — the image is built in two stages: a builder that installs dependencies, and a lean runner that copies the builder's production `node_modules` and the app files, running as a non-root user. Measured on this machine: single-stage naive build **286 MB** vs multi-stage **270 MB**. The gap is modest because this app has no dev-only dependencies (typescript, compilers, test frameworks) — with a real build toolchain the multi-stage saving is far bigger, and it also guarantees nothing like `.env` or build context leaks into the image.

## Local development without Docker

```bash
cp .env.example .env   # point DATABASE_URL at any reachable Postgres
npm install
npm start              # or: npm run dev
```

---

# Secure Auth API

A Supabase-backed authentication API — sign up, log in, log out, and access protected routes that require a valid JWT. Built as the FlyRank Auth assignment (BE-02): instead of writing cryptography by hand, Supabase is the **Identity Provider (IdP)** — it stores accounts, hashes passwords, and issues signed JWTs. This server only verifies them.

The trust triangle:

```
Client ──email+password──> Supabase Auth (IdP) ──JWT──> this server ──getUser()──> Supabase
```

## How it works

- **Sign up / Log in**: the client sends credentials to your backend, which forwards them to Supabase (the server never sees or stores a password).
- **The token**: Supabase validates the credentials and returns a JWT (access token) plus a refresh token.
- **The request**: the client attaches the JWT as `Authorization: Bearer <token>`.
- **Verification**: `requireAuth` middleware extracts the token and asks Supabase's `getUser()` whether it is valid. If it is, the route handler runs; otherwise the client gets `401`.

## Setup

1. Create a free project at [supabase.com](https://supabase.com) (or reuse an existing one).
2. Copy the environment template: `cp .env.example .env`
3. Fill in your project values (Project Settings → API):
4. In the dashboard, disable **Authentication → Providers → Email → Confirm email** so signup can be followed by an immediate login.

| Variable | Example | Used for |
|----------|---------|----------|
| `SUPABASE_URL` | `https://your-project-ref.supabase.co` | Your Supabase project URL |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIs...` | The **anon** (publishable) API key — safe to expose to clients; Row Level Security protects the data |
| `PORT` | `3000` | HTTP port |

`.env` is gitignored — never commit your Supabase keys. The anon key is a publishable key (not a secret), but your project URL + key pair is still your project's identity, so it stays out of git like everything else in `.env`.

## Run it

```bash
npm install
npm run start:auth    # or: npm run dev:auth for auto-reload
```

The server logs `Server running and connected to Supabase on port 3000` and Swagger UI lives at `http://localhost:3000/docs`.

> Note: `npm start` runs the Task API above, `npm run start:auth` runs this Auth API — both use `PORT` from `.env`, so run one at a time.

## Quick test

```bash
# Sign up (201)
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123"}'

# Log in (200) — copy the access_token from the response
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123"}'

# Public route (200) — no token needed
curl -i http://localhost:3000/public/info

# Protected route — 401 without a token
curl -i http://localhost:3000/protected/profile

# Protected route (200) — paste the access_token
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <PASTE_ACCESS_TOKEN>"

# Log out (204) — afterwards the same token is rejected
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <PASTE_ACCESS_TOKEN>"
```

> Supabase blocks signups from reserved domains like `example.com` (`Email address is invalid`) — use a normal domain such as `you@gmail.com` for testing.

## API reference

| Method | Path | Auth | Description | Success | Errors |
|--------|------|------|-------------|---------|--------|
| `POST` | `/auth/signup` | Open | Create a new user account — body `{"email", "password"}` | `201` user object | `400` missing fields / Supabase rejection |
| `POST` | `/auth/login` | Open | Authenticate user and return JWTs — body `{"email", "password"}` | `200` `access_token`, `refresh_token`, `user` | `400` missing fields, `401` wrong credentials |
| `POST` | `/auth/logout` | Bearer | Terminate the user session (revokes it in Supabase) | `204` no content | `400` revoke failure, `401` bad token |
| `GET` | `/protected/profile` | Bearer | Read private profile data (id, email, created_at) | `200` | `401` missing / invalid / expired token |
| `GET` | `/protected/dashboard` | Bearer | Demo protected route — same middleware, no duplicated logic | `200` | `401` missing / invalid / expired token |
| `GET` | `/public/info` | None | Public message, no authentication | `200` | — |

Status code contract: **201** signup, **200** successful login/read, **204** logout, **400** missing inputs, **401** missing/incorrect/expired token.

## Why middleware

Every protected route runs through the same `requireAuth` function (`auth-server.js`): it parses the `Authorization: Bearer <token>` header, calls `supabase.auth.getUser(token)`, and attaches the verified user to `req.user`. Route handlers stay small — they run only after the guard has passed, and a new protected route is just one `requireAuth` argument away.

## Swagger UI

![Swagger UI screenshot](docs-screenshot.png)

The lock icon next to the `/protected/*` routes means they need a token. Click **Authorize**, paste an `access_token` from `/auth/login`, then **Try it out** on `/protected/profile` directly from the browser.

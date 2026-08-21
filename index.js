// Task API — Express CRUD server for tasks.
//
// Storage lives in repository/ — one adapter per engine, chosen by the
// repository factory from DATABASE_URL (.env). The routes below only speak
// the repository interface: validation and status codes stay here, SQL lives
// in the adapter. That is why "switch storage" changes exactly one module.
const express = require('express');
require('dotenv').config(); // load DATABASE_URL / PORT from .env (gitignored)
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');
const { createRepository } = require('./repository');
const { pingRedisOnce } = require('./redis-ping');
const { inputSchema, outputSchema } = require('./src/llm/schema');
const { getStubEnrich } = require('./src/llm/stub');
const { getSystemPrompt, getPromptVersion } = require('./src/llm/prompt');
const { createLlmClient, callWithRetry } = require('./src/llm/client');
const { get: cacheGet, set: cacheSet } = require('./src/llm/cache');
const fs = require('fs');
const path = require('path');
const app = express();

// Helpers for Stage 3 — model is untrusted input, must go through schema
function extractJson(raw) {
  let text = String(raw ?? '').trim();
  // Strip ```json ... ``` fences if present
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) text = fence[1];
  // Find outermost JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) text = text.slice(start, end + 1);
  return text.trim();
}

function tryParseAndValidate(raw) {
  try {
    const jsonStr = extractJson(raw);
    const obj = JSON.parse(jsonStr);
    return outputSchema.safeParse(obj);
  } catch (e) {
    return { success: false, error: e, raw };
  }
}
const port = process.env.PORT || 3000;

// Express needs this to parse JSON request bodies.
app.use(express.json());

// ---------------------------------------------------------------------------
// Stage 1 — connect, create the table, seed on first run, then serve.
// ---------------------------------------------------------------------------
async function main() {
  // The factory picks the storage engine from DATABASE_URL (in .env, which is
  // gitignored — .env.example shows the keys). Fail fast: if the database is
  // unreachable at boot we log and exit instead of half-running; docker
  // compose orders the stack so the db is healthy before the api starts.
  const repo = createRepository();
  await repo.ensureSchemaAndSeed();
  // Stretch extra: prove Redis is reachable, but never block boot on it.
  await pingRedisOnce();

  // Stage 5 — Swagger UI at /docs.
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  // The front door.
  app.get('/', (req, res) => {
    res.json({
      name: 'Task API',
      version: '1.0',
      endpoints: ['/tasks', '/stats', '/reset', '/enrich'],
    });
  });

  // -------------------------------------------------------------------------
  // POST /enrich — the LLM endpoint (Stages 1-4). Validates before spend,
  // stub when LLM_STUB=1, real model otherwise (prompt is a versioned file,
  // user content isolated in role:user via JSON.stringify).
  // Stage 2: wire real call (return raw text for now). Stage 3: parse/validate/repair.
  // -------------------------------------------------------------------------
  app.post('/enrich', async (req, res) => {
    const parsed = inputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = first.path.join('.') || 'text';
      return res.status(400).json({ error: `${field}: ${first.message}` });
    }

    const { text } = parsed.data;

    // Stub mode — zero LLM calls (Stage 1)
    if (process.env.LLM_STUB === '1') {
      const stub = getStubEnrich(text);
      const checked = outputSchema.safeParse(stub);
      if (!checked.success) {
        return res.status(500).json({ error: 'Stub failed output validation' });
      }
      return res.json(checked.data);
    }

    // Kill switch (Stage 4) — also checked here so Stage 2 wiring respects it early
    if (process.env.LLM_ENABLED === 'false') {
      return res.status(503).json({ error: 'LLM disabled', fallback: getStubEnrich(text) });
    }

    // Bonus cache — prompt-versioned key, hit returns saved validated JSON (Stage 4+)
    const promptVersion = getPromptVersion();
    const cached = cacheGet(text, promptVersion);
    if (cached) {
      // Log cache hit (no LLM call)
      try {
        fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
        fs.appendFileSync(path.join(__dirname, 'logs', 'llm.jsonl'), JSON.stringify({
          timestamp: new Date().toISOString(),
          prompt_version: promptVersion,
          model: process.env.LLM_MODEL || 'cache',
          input_tokens: 0,
          output_tokens: 0,
          duration_ms: 0,
          repair: 0,
          cached: true,
        }) + '\n');
      } catch (e) {}
      return res.json(cached);
    }

    // Real LLM path — prompt is a file, user data in separate message, JSON-encoded
    // Stage 3: parse + validate, repair once on failure, quarantine on second failure, never raw text
    try {
      const systemPrompt = getSystemPrompt();
      const client = createLlmClient();
      const model = process.env.LLM_MODEL;

      if (!process.env.LLM_BASE_URL || !process.env.LLM_API_KEY || !model) {
        return res.status(500).json({ error: 'LLM not configured — set LLM_BASE_URL/API_KEY/MODEL' });
      }

      // First LLM call — capture duration/usage for cost log (Stage 4)
      const first = await callWithRetry(client, {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(text) },
        ],
        temperature: 0,
      });
      let llmRes = first.res;
      let durationMs = first.duration;
      let usage = llmRes.usage || null;
      let raw = llmRes.choices?.[0]?.message?.content ?? '';
      let result = tryParseAndValidate(raw);
      let repaired = false;
      let repairDuration = 0;

      // Repair once if parsing or validation failed
      if (!result.success) {
        const errMsg = result.error?.issues ? result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : String(result.error?.message || result.error);
        const repairSystem = systemPrompt + `\n\nYour previous answer was rejected for this reason: ${errMsg}. Return only corrected JSON matching the schema.`;
        try {
          const repair = await callWithRetry(client, {
            model,
            messages: [
              { role: 'system', content: repairSystem },
              { role: 'user', content: JSON.stringify(text) },
              { role: 'assistant', content: raw },
              { role: 'user', content: `Validation error: ${errMsg}. Return only corrected JSON.` },
            ],
            temperature: 0,
          });
          const repairRes = repair.res;
          repairDuration = repair.duration;
          const repairRaw = repairRes.choices?.[0]?.message?.content ?? '';
          const repairResult = tryParseAndValidate(repairRaw);
          if (repairResult.success) {
            result = repairResult;
            repaired = true;
            llmRes = repairRes;
            usage = repairRes.usage || usage;
            raw = repairRaw;
          } else {
            result = repairResult;
          }
        } catch (e) {
          // repair call itself failed — keep original failure
        }
        if (!result.success) {
          // Quarantine — never guess default, never crash
          const entry = {
            timestamp: new Date().toISOString(),
            input: text,
            raw_output: raw,
            validation_error: errMsg,
            prompt_version: promptVersion,
          };
          try {
            fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
            fs.appendFileSync(path.join(__dirname, 'logs', 'quarantine.jsonl'), JSON.stringify(entry) + '\n');
          } catch (e) { console.error('quarantine write failed', e); }
          // Cost log even on failure — one line per endpoint call (Stage 4)
          try {
            fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
            fs.appendFileSync(path.join(__dirname, 'logs', 'llm.jsonl'), JSON.stringify({
              timestamp: new Date().toISOString(),
              prompt_version: promptVersion,
              model,
              input_tokens: usage?.prompt_tokens ?? 0,
              output_tokens: usage?.completion_tokens ?? 0,
              duration_ms: durationMs + repairDuration,
              repair: repaired ? 1 : 0,
              cached: false,
            }) + '\n');
          } catch (e) { /* log failure not fatal */ }
          return res.status(422).json({ error: 'Invalid model output', details: errMsg });
        }
      }

      // Cost log — one structured line per successful call (Stage 4)
      try {
        fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
        fs.appendFileSync(path.join(__dirname, 'logs', 'llm.jsonl'), JSON.stringify({
          timestamp: new Date().toISOString(),
          prompt_version: promptVersion,
          model,
          input_tokens: usage?.prompt_tokens ?? 0,
          output_tokens: usage?.completion_tokens ?? 0,
          duration_ms: repaired ? durationMs + repairDuration : durationMs,
          repair: repaired ? 1 : 0,
          cached: false,
        }) + '\n');
      } catch (e) { /* log failure not fatal */ }

      // Bonus cache — store validated result, key includes prompt version (bust on v2)
      try { cacheSet(text, promptVersion, result.data); } catch (e) {}

      // Success — return clean schema-shaped JSON, never raw text
      return res.json(result.data);
    } catch (err) {
      const status = err.status || 500;
      if (status === 401) return res.status(500).json({ error: 'LLM auth failed — check LLM_API_KEY' });
      if (err.name === 'APIConnectionTimeoutError' || status === 504) return res.status(504).json({ error: 'LLM timeout' });
      if (status === 429) return res.status(429).json({ error: 'LLM rate limited', retry_after: err.headers?.get?.('retry-after') });
      console.error('LLM call failed', err);
      return res.status(500).json({ error: 'LLM call failed', details: err.message });
    }
  });

  // Stretch extra — real health check: the DB probe runs SELECT 1 through the
  // repository. Boot fails fast when the DB is down, so a 503 here means the
  // database died after startup — exactly what a deploy gate should catch.
  app.get('/health', async (req, res) => {
    try {
      await repo.ping();
      res.json({ status: 'ok', db: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', db: 'unreachable' });
    }
  });

  // Parse a :id path segment into a positive integer. Anything else (NaN,
  // decimals, negatives) can never match a stored id — treat it as unknown.
  // Postgres would raise a type error on such a value, so we guard here.
  function parseId(raw) {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  // -------------------------------------------------------------------------
  // Read: list + single task (with optional filtering/search extras).
  // -------------------------------------------------------------------------
  app.get('/tasks', async (req, res) => {
    const filters = {};

    // Extras: GET /tasks?done=true  → only finished (or only open) tasks.
    if (req.query.done !== undefined) {
      if (req.query.done !== 'true' && req.query.done !== 'false') {
        return res.status(400).json({ error: 'done must be true or false' });
      }
      filters.done = req.query.done === 'true';
    }

    // Extras: GET /tasks?search=milk → tasks whose title contains the word.
    if (req.query.search !== undefined) {
      const word = String(req.query.search).trim();
      if (word === '') {
        return res.status(400).json({ error: 'search must not be empty' });
      }
      filters.search = word;
    }

    res.json(await repo.list(filters));
  });

  // -------------------------------------------------------------------------
  // Create.
  // -------------------------------------------------------------------------
  app.post('/tasks', async (req, res) => {
    const { title } = req.body ?? {};

    if (title === undefined || title === null || String(title).trim() === '') {
      return res.status(400).json({ error: 'title is required and cannot be empty' });
    }

    const task = await repo.create(String(title).trim());
    res.status(201).json(task);
  });

  // -------------------------------------------------------------------------
  // Extras: stats and reset. Declared before "/tasks/:id" so the names are
  // not read as an id.
  // -------------------------------------------------------------------------
  app.get('/stats', async (req, res) => {
    res.json(await repo.stats());
  });

  // Extras — reset back to the 3 example tasks. Handy for demos.
  app.post('/reset', async (req, res) => {
    res.json(await repo.reset());
  });

  // -------------------------------------------------------------------------
  // Read one.
  // -------------------------------------------------------------------------
  app.get('/tasks/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }
    const task = await repo.getById(id);
    if (!task) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
    res.json(task);
  });

  // -------------------------------------------------------------------------
  // Update & Delete.
  // -------------------------------------------------------------------------
  app.put('/tasks/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    const body = req.body ?? {};
    const hasTitle = Object.prototype.hasOwnProperty.call(body, 'title');
    const hasDone = Object.prototype.hasOwnProperty.call(body, 'done');

    // Client may send title, done, or both — at least one is required.
    if (!hasTitle && !hasDone) {
      return res.status(400).json({ error: 'request body must include title and/or done' });
    }

    const patch = {};
    if (hasTitle) {
      if (body.title === null || String(body.title).trim() === '') {
        return res.status(400).json({ error: 'title cannot be empty' });
      }
      patch.title = String(body.title).trim();
    }
    if (hasDone) {
      if (typeof body.done !== 'boolean') {
        return res.status(400).json({ error: 'done must be a boolean' });
      }
      patch.done = body.done;
    }

    const task = await repo.update(id, patch);
    if (!task) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
    res.json(task);
  });

  app.delete('/tasks/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    const removed = await repo.remove(id);
    if (!removed) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }

    // 204 = success, no response body.
    res.status(204).send();
  });

  // Last resort — every unexpected failure lands here as JSON. Express 5
  // forwards rejected async handlers to this middleware automatically.
  // (The fourth parameter is required — it's what marks this as error middleware.)
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(port, () => {
    console.log(`CRUD API listening on port ${port}`);
  });
}

main().catch((err) => {
  // Fail fast: a database that can't be reached at boot is fatal — the API
  // would otherwise serve errors from a broken store.
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});

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
const app = express();
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
      endpoints: ['/tasks', '/stats', '/reset'],
    });
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

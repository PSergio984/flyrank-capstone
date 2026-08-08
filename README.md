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
| `GET` | `/docs` | OpenAPI docs (Swagger UI), spec in `openapi.json` |

All queries are parameterized — values are passed to the driver separately, never glued into SQL strings.

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
- **Multi-stage Dockerfile** — the image is built in two stages: a builder that installs dependencies, and a lean runner that copies only production `node_modules` and the app files, running as a non-root user. Measured on this machine: single-stage naive build **286 MB** vs multi-stage **270 MB**. The gap is modest because this app has no dev-only dependencies (typescript, compilers, test frameworks) — with a real build toolchain the multi-stage saving is far bigger, and it also guarantees nothing like `.env` or build context leaks into the image.

## Local development without Docker

```bash
cp .env.example .env   # point DATABASE_URL at any reachable Postgres
npm install
npm start              # or: npm run dev
```

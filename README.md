# Task API

A simple Express CRUD API for managing tasks, backed by SQLite. Week 2 (BE-A2) submission — the Week 1 API (`server.js`) grew from a minimal two-endpoint demo into a full CRUD API whose storage layer is a real database, while keeping the client-facing API stable.

## Why SQLite?

SQLite was chosen because it is a real SQL database that still fits a small local project:

- **No separate server to install or run** — just a library (`better-sqlite3`) and a file. The database is created automatically the first time the app starts.
- **Data survives restarts** — tasks are stored on disk, not in an in-memory array.
- **Synchronous API** — `better-sqlite3` keeps the Express handlers simple (no `async`/`await` for queries).
- **Enough SQL to practice** `SELECT`, `INSERT`, `UPDATE`, and `DELETE` without the overhead of Postgres or MySQL.

## Database file

Tasks are stored in **`tasks.db`** in the project root (the same folder as `index.js`).

The file is created automatically on first run, along with the `tasks` table. The table starts with three example tasks (only when empty — restarting the server won't duplicate them). `tasks.db` is listed in `.gitignore`, so each machine keeps its own copy.

## Getting started

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

For auto-reload while editing:

```bash
npm run dev
```

The API runs at `http://localhost:3000` (set the `PORT` environment variable to override). OpenAPI docs (Swagger UI) are at `http://localhost:3000/docs`; the spec lives in `openapi.json`.

## Database viewer

Open `tasks.db` with any SQLite viewer (DB Browser for SQLite is recommended) to inspect and edit the data directly — the API reflects manual database changes immediately.

![Database viewer screenshot](screenshot.png)

## Example SQL query

```sql
SELECT id, title, done, created_at, updated_at FROM tasks ORDER BY id;
```

That is the query behind `GET /tasks` — it reads every row from the database.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API metadata |
| `GET` | `/health` | Health check |
| `GET` | `/tasks` | List tasks (`?done=true` / `?done=false` / `?search=milk`) |
| `GET` | `/tasks/:id` | Get one task (404 if unknown) |
| `POST` | `/tasks` | Create a task — `{"title": "Buy milk"}` (400 if title missing) |
| `PUT` | `/tasks/:id` | Update title and/or done (400 if body empty, 404 if unknown) |
| `DELETE` | `/tasks/:id` | Delete a task (204 on success, 404 if unknown) |
| `GET` | `/stats` | Task counts computed in SQL with `COUNT()` |
| `POST` | `/reset` | Clear the table and restore the three example tasks |

## Examples

```bash
curl http://localhost:3000/tasks
curl "http://localhost:3000/tasks?done=false"
curl "http://localhost:3000/tasks?search=book"

curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy milk"}'

curl -X PUT http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"done": true}'

curl -X DELETE http://localhost:3000/tasks/1
```

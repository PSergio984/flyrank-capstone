// Task API — Express CRUD server for tasks, backed by SQLite.
// Stages 0–5 of the W3 assignment, plus the optional extras.
const express = require('express');
const Database = require('better-sqlite3'); // sync SQLite driver (no async/await needed)
const app = express();
const port = process.env.PORT || 3000;

// Express needs this to parse JSON request bodies.
app.use(express.json());

// ---------------------------------------------------------------------------
// Stage 0 — SQLite database: opens (or creates) tasks.db in this folder.
// ---------------------------------------------------------------------------
const db = new Database('tasks.db');

// Create the table on first run. Safe to call every time — IF NOT EXISTS
// means it does nothing when the table is already there.
// SQLite has no real boolean type, so done is stored as 0/1 (INTEGER).
// created_at / updated_at are stored as TEXT (YYYY-MM-DD HH:MM:SS).
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Existing tasks.db files may predate the timestamp columns — add them if missing.
// ALTER TABLE only allows constant defaults, so we backfill with datetime('now').
const taskColumns = db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);
if (!taskColumns.includes('created_at')) {
  db.exec(`ALTER TABLE tasks ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`);
  db.exec(`UPDATE tasks SET created_at = datetime('now') WHERE created_at = ''`);
}
if (!taskColumns.includes('updated_at')) {
  db.exec(`ALTER TABLE tasks ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
  db.exec(`UPDATE tasks SET updated_at = datetime('now') WHERE updated_at = ''`);
}

const SEED_TASKS = [
  { id: 1, title: 'Buy groceries', done: false },
  { id: 2, title: 'Walk the dog', done: true },
  { id: 3, title: 'Read a book', done: false },
];

const insertSeedTask = db.prepare('INSERT INTO tasks (id, title, done) VALUES (?, ?, ?)');

function seedTasks(tasks) {
  for (const task of tasks) {
    // Convert JS boolean → 0/1 for SQLite. Timestamps use column defaults.
    insertSeedTask.run(task.id, task.title, task.done ? 1 : 0);
  }
}

// Seed only when empty, so restarting the server won't duplicate rows.
const countTasks = db.prepare('SELECT COUNT(*) AS count FROM tasks');
if (countTasks.get().count === 0) {
  db.transaction(seedTasks)(SEED_TASKS);
}

// ---------------------------------------------------------------------------
// Stage 0 — start the server
// ---------------------------------------------------------------------------
app.listen(port, () => {
  console.log(`CRUD API listening on port ${port}`);
});

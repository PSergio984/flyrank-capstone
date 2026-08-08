// SQLite adapter for the Task API repository interface (the A2 storage engine).
// Implements the same interface as repository/postgres.js — the route layer in
// index.js never touches SQL, so swapping engines changes only this file.
// NOTE: this adapter is temporary. It exists to make the extraction commit
// verifiable (behaviour unchanged), and is deleted once Postgres takes over
// (Stage 3). Git history keeps it as the A2 reference.
const Database = require('better-sqlite3');

// The three example tasks every fresh database starts with. Inserted only when
// the table is empty, so restarting the server never duplicates them.
const SEED_TASKS = [
  { title: 'Buy groceries', done: false },
  { title: 'Walk the dog', done: true },
  { title: 'Read a book', done: false },
];

// Columns every read selects, in a fixed order — the API's JSON shape.
const TASK_COLUMNS = 'id, title, done, created_at, updated_at';

// Normalize a raw driver row into the JSON shape the API returns.
// SQLite stores done as 0/1 (no real boolean type) and timestamps as
// 'YYYY-MM-DD HH:MM:SS' strings — convert here, never in the routes.
function rowToTask(row) {
  return {
    id: row.id,
    title: row.title,
    done: Boolean(row.done),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Factory: opens (or creates) the SQLite file and returns the repository.
// Every method is async so the interface matches the Postgres adapter
// (pg is asynchronous; better-sqlite3 is synchronous under the hood).
function createTaskRepository(dbPath = 'tasks.db') {
  const db = new Database(dbPath);

  // Create the table on first run — IF NOT EXISTS makes it safe to call
  // every boot. done is INTEGER (SQLite has no boolean), timestamps TEXT.
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Older tasks.db files may predate the timestamp columns — add them if
  // missing. ALTER TABLE only allows constant defaults, so backfill by hand.
  const taskColumns = db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);
  if (!taskColumns.includes('created_at')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`);
    db.exec(`UPDATE tasks SET created_at = datetime('now') WHERE created_at = ''`);
  }
  if (!taskColumns.includes('updated_at')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
    db.exec(`UPDATE tasks SET updated_at = datetime('now') WHERE updated_at = ''`);
  }

  // Seed only when empty — the first-run rule. Wrapped in a transaction so a
  // partial seed can't leave the table half-filled.
  function insertSeeds(tasks) {
    const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
    db.transaction((list) => {
      for (const task of list) insert.run(task.title, task.done ? 1 : 0);
    })(tasks);
  }

  return {
    // Boot: make sure the table exists and the three example tasks are there
    // (only on a truly empty table). Called once at startup, before listening.
    async ensureSchemaAndSeed() {
      const count = db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count;
      if (count === 0) insertSeeds(SEED_TASKS);
    },

    // GET /tasks — optional ?done= / ?search= filters narrow the SQL itself.
    async list({ done, search } = {}) {
      let sql = `SELECT ${TASK_COLUMNS} FROM tasks WHERE 1=1`;
      const params = [];
      if (done !== undefined) {
        sql += ' AND done = ?';
        params.push(done ? 1 : 0);
      }
      if (search !== undefined) {
        sql += ' AND LOWER(title) LIKE ?';
        params.push(`%${search.toLowerCase()}%`);
      }
      sql += ' ORDER BY id';
      return db.prepare(sql).all(...params).map(rowToTask);
    },

    // GET /tasks/:id — null means "unknown id" and the route turns it into 404.
    async getById(id) {
      const row = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(id);
      return row ? rowToTask(row) : null;
    },

    // POST /tasks — insert, then read the row back (SQLite assigns id + timestamps).
    async create(title) {
      const result = db.prepare('INSERT INTO tasks (title, done) VALUES (?, 0)').run(title);
      const row = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(result.lastInsertRowid);
      return rowToTask(row);
    },

    // PUT /tasks/:id — partial update: merge the patch over the stored row,
    // bump updated_at. Returns null when the id is unknown (route → 404).
    async update(id, patch) {
      const row = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(id);
      if (!row) return null;
      const title = patch.title !== undefined ? patch.title : row.title;
      const done = patch.done !== undefined ? (patch.done ? 1 : 0) : row.done;
      db.prepare(
        `UPDATE tasks SET title = ?, done = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(title, done, id);
      const updated = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(id);
      return rowToTask(updated);
    },

    // DELETE /tasks/:id — true when a row was actually removed (route → 204),
    // false when the id was unknown (route → 404).
    async remove(id) {
      const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
      return result.changes > 0;
    },

    // GET /stats — counts computed in SQL, not in JavaScript.
    async stats() {
      return db
        .prepare(
          `SELECT
             COUNT(*) AS total,
             COUNT(CASE WHEN done = 1 THEN 1 END) AS done,
             COUNT(CASE WHEN done = 0 THEN 1 END) AS open
           FROM tasks`
        )
        .get();
    },

    // POST /reset — wipe the table and restore the three example tasks.
    async reset() {
      db.prepare('DELETE FROM tasks').run();
      insertSeeds(SEED_TASKS);
      return db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks ORDER BY id`).all().map(rowToTask);
    },

    // Health probe (SELECT 1) used by the /health endpoint.
    async ping() {
      db.prepare('SELECT 1').get();
    },
  };
}

module.exports = { createTaskRepository };

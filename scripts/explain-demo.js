// Stretch extra: show EXPLAIN ANALYZE before and after adding an index on
// `done`, the column the filters query on. Seeding 100k rows makes the
// difference visible (three rows would use the same plan either way).
//
// Usage: npm run seed:demo   (reads DATABASE_URL from .env)
//
// The index is created only for the demo and dropped afterwards; the table
// is restored to its three example tasks, leaving the database as it was.
require('dotenv').config();
const { Pool } = require('pg');

const SEED_TITLES = ['Buy groceries', 'Walk the dog', 'Read a book', 'Write report', 'Call mom'];
const ROW_COUNT = 100000;
const BATCH = 1000;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Start clean — the demo needs a table whose contents we control.
  await pool.query('TRUNCATE tasks RESTART IDENTITY');

  // Insert 100k rows in batches (one multi-row INSERT per batch is far
  // faster than 100k single-row inserts). `done` is skewed ~1% true — like
  // real task data, where almost everything is still open. A 50/50 split
  // would make the planner (correctly) ignore the index: when half the rows
  // match, a full scan is cheaper. Selectivity is what makes indexes useful.
  for (let batch = 0; batch < ROW_COUNT / BATCH; batch++) {
    const values = [];
    const params = [];
    for (let i = 0; i < BATCH; i++) {
      const n = batch * BATCH + i;
      params.push(`${SEED_TITLES[n % SEED_TITLES.length]} #${n}`, n % 100 === 0);
      values.push(`($${params.length - 1}, $${params.length})`);
    }
    await pool.query(`INSERT INTO tasks (title, done) VALUES ${values.join(', ')}`, params);
  }
  console.log(`seeded ${ROW_COUNT} rows (done = true on ~1% of them)`);

  const printPlan = (rows) => rows.forEach((r) => console.log(r['QUERY PLAN']));

  // Before: full table scan — no index exists on done.
  const before = await pool.query('EXPLAIN ANALYZE SELECT * FROM tasks WHERE done = true');
  console.log('\n--- BEFORE (no index) ---');
  printPlan(before.rows);

  await pool.query('CREATE INDEX idx_tasks_done ON tasks (done)');

  // After: the planner can use the index instead of scanning the table.
  const after = await pool.query('EXPLAIN ANALYZE SELECT * FROM tasks WHERE done = true');
  console.log('\n--- AFTER (CREATE INDEX idx_tasks_done ON tasks (done)) ---');
  printPlan(after.rows);

  // Leave no trace: drop the index and restore the three example tasks.
  await pool.query('DROP INDEX idx_tasks_done');
  await pool.query('TRUNCATE tasks RESTART IDENTITY');
  const seeds = [
    ['Buy groceries', false],
    ['Walk the dog', true],
    ['Read a book', false],
  ];
  for (const [title, done] of seeds) {
    await pool.query('INSERT INTO tasks (title, done) VALUES ($1, $2)', [title, done]);
  }
  console.log('\ncleaned up — index dropped, 3 example tasks restored');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

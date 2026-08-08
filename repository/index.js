// Repository factory — the single place that knows which storage engine the
// app uses. It reads DATABASE_URL (from .env, which is gitignored) and returns
// the matching adapter. Everything else in the codebase just calls the
// repository interface, so switching engines never touches the routes.
//
// Only Postgres is wired here now. The SQLite adapter used to be chosen from
// this file too — git history keeps it as the A2 reference.
const { createTaskRepository: createPostgresRepository } = require('./postgres');

function createRepository() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and fill in a connection string.'
    );
  }
  if (!url.startsWith('postgres')) {
    throw new Error(`Unsupported DATABASE_URL scheme: ${url.split(':')[0]} — expected postgres://`);
  }
  return createPostgresRepository(url);
}

module.exports = { createRepository };

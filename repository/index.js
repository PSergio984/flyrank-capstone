// Repository factory — the only place that decides which storage engine the
// app uses. It reads DATABASE_URL (from .env, which is gitignored) and returns
// the matching adapter. Everything else in the codebase just calls the
// repository interface, so switching engines never touches the routes.
const { createTaskRepository: createSqliteRepository } = require('./sqlite');
const { createTaskRepository: createPostgresRepository } = require('./postgres');

function createRepository() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and fill in a connection string.'
    );
  }
  if (url.startsWith('postgres')) {
    return createPostgresRepository(url);
  }
  if (url.startsWith('sqlite')) {
    // sqlite://tasks.db → the file path; used for local runs without Docker.
    return createSqliteRepository(url.replace(/^sqlite:\/\//, '') || 'tasks.db');
  }
  throw new Error(`Unsupported DATABASE_URL scheme: ${url.split(':')[0]}`);
}

module.exports = { createRepository };

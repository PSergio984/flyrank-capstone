// Secure Auth API — Supabase-backed authentication for the FlyRank backend.
//
// Supabase is the Identity Provider (IdP): it stores accounts and issues JWTs,
// so this server never touches passwords or crypto. The trust triangle:
//   Client ──credentials──> Supabase ──JWT──> this server ──getUser()──> Supabase
const express = require('express');
require('dotenv').config(); // load SUPABASE_URL / SUPABASE_KEY / PORT from .env (gitignored)
const { createClient } = require('@supabase/supabase-js');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi-auth.json');

const app = express();
const port = process.env.PORT || 3000;

// Stage 0 — the Supabase client. The anon key is safe to expose to clients:
// Row Level Security on the database is what actually protects the data.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(express.json());

// ---------------------------------------------------------------------------
// Stage 4 — the guard extracted into reusable middleware. Applied to every
// protected route, so route handlers never repeat token logic: by the time a
// handler runs, the user is verified and sitting on req.user.
// ---------------------------------------------------------------------------
async function requireAuth(req, res, next) {
  // The header must look exactly like "Bearer <token>".
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match ? match[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Ask the IdP whether this JWT is real, unexpired, and untampered.
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Verified — stash the user (and the raw token, for sign-out) on the request.
  req.user = data.user;
  req.token = token;
  next();
}

// ---------------------------------------------------------------------------
// Stage 1 — open auth: sign up & log in. Credentials go straight to Supabase;
// this server never sees or stores passwords.
// ---------------------------------------------------------------------------
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body ?? {};

  // Input validation: missing fields never reach the IdP.
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // 201 Created — the user object Supabase just registered.
  res.status(201).json(data.user);
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Wrong password, unknown account, unconfirmed email — same answer.
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  // 200 OK — hand the client the JWTs it will present to protected routes.
  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user,
  });
});

// ---------------------------------------------------------------------------
// Stage 2 — the gates: public (no guard) vs protected (middleware).
// ---------------------------------------------------------------------------
app.get('/public/info', (req, res) => {
  res.json({ message: 'Welcome stranger! This info is public.' });
});

// Stage 3/4 — requireAuth verifies the token before this handler ever runs.
app.get('/protected/profile', requireAuth, (req, res) => {
  const { id, email, created_at } = req.user;
  res.json({ id, email, created_at });
});

// Stage 4 — a second protected route, same middleware, zero duplicated logic.
app.get('/protected/dashboard', requireAuth, (req, res) => {
  res.json({
    message: `Welcome back, ${req.user.email}!`,
    protected_data: 'Only authenticated users can see this.',
  });
});

// Stage 4 — logout: protected like every other guarded route. The middleware
// guarantees the token is valid before we hand it back to Supabase to revoke
// its session (admin.signOut revokes server-side by JWT, unlike the browser
// signOut which only clears local storage).
app.post('/auth/logout', requireAuth, async (req, res) => {
  const { error } = await supabase.auth.admin.signOut(req.token);
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  res.status(204).send();
});

// Stage 5 — Swagger UI at /docs (spec: openapi-auth.json). Protected routes
// are linked to the bearerAuth security scheme, which renders the Authorize
// padlock in the UI.
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.listen(port, () => {
  console.log(`Server running and connected to Supabase on port ${port}`);
});

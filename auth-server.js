// Secure Auth API — Supabase-backed authentication for the FlyRank backend.
//
// Supabase is the Identity Provider (IdP): it stores accounts and issues JWTs,
// so this server never touches passwords or crypto. The trust triangle:
//   Client ──credentials──> Supabase ──JWT──> this server ──getUser()──> Supabase
const express = require('express');
require('dotenv').config(); // load SUPABASE_URL / SUPABASE_KEY / PORT from .env (gitignored)
const { createClient } = require('@supabase/supabase-js');

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

app.listen(port, () => {
  console.log(`Server running and connected to Supabase on port ${port}`);
});

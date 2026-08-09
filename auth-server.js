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

app.listen(port, () => {
  console.log(`Server running and connected to Supabase on port ${port}`);
});

---
wave: 1
id: "express-api"
requirements: ["API-01", "API-02", "API-03", "API-04"]
autonomous: true
---

# Plan: Express.js API Setup

## Objective

Create a working Express.js server with two JSON endpoints (GET / and GET /about) that demonstrates the HTTP request-response cycle.

## Files Modified

- `server.js` — Express app entry point with routes
- `package.json` — Dependencies and scripts
- `.gitignore` — Node.js exclusions
- `README.md` — Setup and usage instructions

## Tasks

### Task 1: Initialize project and install Express

<action>
Run `npm init -y` to create package.json, then `npm install express`.
Configure start script in package.json: `"start": "node server.js"`.
Add a dev script: `"dev": "node --watch server.js"` (Node 18+ watch mode).
</action>

<read_first>
- (no existing code — fresh project)
</read_first>

<acceptance_criteria>
- package.json exists with `express` in dependencies and `start`/`dev` scripts
- node_modules/express exists
</acceptance_criteria>

### Task 2: Create server with GET / endpoint

<action>
Create `server.js` with:
- Import express
- Create app on port `process.env.PORT || 3000`
- Add `express.json()` middleware
- GET `/` returns `{ "message": "Hello, FlyRank!" }` with status 200
- Server logs `Server running on port ${port}` on start
</action>

<read_first>
- package.json (existing project config)
</read_first>

<acceptance_criteria>
- `curl http://localhost:3000/` returns `{"message":"Hello, FlyRank!"}` with 200 status
- Server logs startup message
</acceptance_criteria>

### Task 3: Add GET /about endpoint

<action>
Add GET `/about` route that returns JSON with fields: `name`, `track`, `assignment`, `week`, `status`.
Use placeholder values (user can customize later).
Example: `{ "name": "Your Name", "track": "Backend AI Engineering", "assignment": "BE-01", "week": 1, "status": "Learning Express.js" }`
</action>

<read_first>
- server.js (existing file)
</read_first>

<acceptance_criteria>
- `curl http://localhost:3000/about` returns JSON with all 5 fields and 200 status
</acceptance_criteria>

### Task 4: Add .gitignore and README

<action>
Create `.gitignore` with `node_modules/`, `.env`.
Create `README.md` with project title, setup instructions (`npm install && npm start`), and endpoint documentation.
</action>

<read_first>
- package.json (to reference project name)
</read_first>

<acceptance_criteria>
- .gitignore exists with `node_modules/` entry
- README.md documents both endpoints with example curl commands
</acceptance_criteria>

## Verification

1. `curl http://localhost:3000/` → 200 + welcome JSON
2. `curl http://localhost:3000/about` → 200 + assignment JSON
3. `npm start` starts without errors
4. Clean checkout: `npm install && npm start` works

## must_haves

- Server starts and responds on both endpoints
- Responses are valid JSON with correct status codes

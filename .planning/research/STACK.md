# Stack Research

## Recommended Stack

| Component | Choice | Version | Confidence |
|-----------|--------|---------|------------|
| Runtime | Node.js | 18+ LTS | High |
| Framework | Express.js | 4.x | High |
| Package manager | npm | Latest | High |
| Dev tool | nodemon | 3.x | Medium — optional for dev reload |

## Rationale

- **Express.js** is the standard minimalist Node.js framework — ideal for simple APIs
- **Built-in JSON parsing** via `express.json()` middleware
- No database or additional middleware needed for BE-01 scope

## What NOT to use

- FastAPI, Flask, or other Python frameworks — user chose Node.js
- TypeScript — unnecessary complexity for a 2-endpoint assignment
- Database drivers — BE-01 doesn't require persistence

# FlyRank BE-01 / BE-02

## What This Is

The FlyRank Backend AI Engineering Internship capstone repo. BE-01: a minimal Express.js backend demonstrating the HTTP request-response cycle. BE-02 (current milestone): a Supabase-backed authentication API — sign up, log in, log out, and JWT-protected routes with reusable middleware, documented in Swagger UI.

## Core Value

Ship working, documented Express.js APIs — first the request-response cycle, then secure authentication with Supabase as the Identity Provider, using clean status-code contracts (201/200/204/400/401) and reusable auth middleware.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **API-01**: Express.js server starts and listens on a configurable port
- [ ] **API-02**: GET / returns a welcome JSON message
- [ ] **API-03**: GET /about returns developer and assignment info as JSON
- [ ] **API-04**: Server can be installed and started with `npm install && npm start`

### Out of Scope

- Database or persistence — not needed for BE-01
- Authentication or user management — not part of this assignment
- Frontend UI or HTML rendering — API-only
- Deployment or hosting — local run only

## Context

This is the first assignment in the FlyRank Backend AI Engineering Internship. The assignment brief calls for a simple backend demonstrating the request-response cycle. Express.js and Node.js are the chosen stack.

## Constraints

- **Runtime**: Node.js 18+ required
- **Framework**: Express.js — no additional backend frameworks

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Express.js over FastAPI | User preference for Node.js stack | — Pending |

---

*Last updated: 2026-07-19 after initialization*


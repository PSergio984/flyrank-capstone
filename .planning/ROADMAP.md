# Roadmap: FlyRank BE-01 / BE-02

**BE-01: 4 requirements | 1 phase | All v1 requirements covered ✓**

---

### Phase 1: Express.js API Setup
**Goal:** Ship a working Express.js API with two JSON endpoints
**Mode:** mvp
**Requirements:** API-01, API-02, API-03, API-04
**Success Criteria:**
1. Server starts on port 3000 and logs startup message
2. GET / returns `{"message": "..."}` with status 200
3. GET /about returns developer info JSON with status 200
4. `npm install && npm start` works from clean checkout
5. Server responds correctly to `curl` requests for both endpoints

---

**BE-02: Auth Login & Protect (done) — committed as Stage 0–6**

- Stage 0: setup server and supabase client
- Stage 1: signup and login routes working
- Stage 2: public route and unverified protected route
- Stage 3: profile route token verification
- Stage 4: auth middleware and logout endpoint
- Stage 5: Swagger UI documentation with bearer auth
- Stage 6: publish to GitHub and write README

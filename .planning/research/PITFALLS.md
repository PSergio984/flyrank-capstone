# Pitfalls Research

| Pitfall | Warning Sign | Prevention | Phase |
|---------|-------------|------------|-------|
| Port conflicts | EADDRINUSE error | Use env var PORT with fallback | Phase 1 |
| Not handling JSON correctly | Undefined req.body | Use express.json() middleware | Phase 1 |
| Hardcoded port | Magic number 3000 everywhere | Use process.env.PORT || 3000 | Phase 1 |
| Missing .gitignore | node_modules committed | Add Node.js .gitignore | Phase 1 |
| Server crashes unhandled | Uncaught exceptions crash process | Add process error handlers | Phase 1 |

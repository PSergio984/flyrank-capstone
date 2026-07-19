# Research Summary

## Stack
Node.js + Express.js — minimal setup with `server.js`, `package.json`, `.gitignore`, and `README.md`.

## Table Stakes
- Express.js server on configurable port
- GET / → welcome JSON
- GET /about → assignment info JSON
- npm scripts for start/dev
- Node.js .gitignore

## Watch Out For
- Use `process.env.PORT` for port configuration
- Add `express.json()` middleware for JSON handling
- Include proper .gitignore to exclude node_modules

# Architecture Research

## Project Structure

```
flyrank-be01/
├── server.js          # Entry point — server setup and route handlers
├── package.json       # Dependencies and scripts
├── .gitignore         # Node.js gitignore
└── README.md          # Project documentation
```

## Data Flow

```
Client (browser/curl)
    │
    ▼
Express.js Server (localhost:3000)
    │
    ├── GET /       →  { "message": "..." }
    │
    └── GET /about  →  { "name": "...", "assignment": "BE-01", ... }
```

## Component Boundaries

- **Server entry**: `server.js` — Express app initialization, middleware, route definitions
- **Routes**: Inline in `server.js` for simplicity (2 endpoints)
- **Config**: Environment variable for PORT (default 3000)

# FlyRank BE-01

A minimal Express.js backend with two JSON endpoints demonstrating the HTTP request-response cycle.

## Setup

```bash
npm install
```

## Usage

```bash
npm start
```

Server starts on `http://localhost:3000`.

## Endpoints

### GET /

Returns a welcome message.

```bash
curl http://localhost:3000/
```

Response: `{"message":"Hello, FlyRank!"}`

### GET /about

Returns assignment and developer info.

```bash
curl http://localhost:3000/about
```

Response: `{"name":"Your Name","track":"Backend AI Engineering","assignment":"BE-01","week":1,"status":"Learning Express.js"}`

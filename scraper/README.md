# A9 · The polite scraper

A small, polite scraping pipeline for the Week 5 (A9) assignment. It downloads the first
three catalogue pages of **Books to Scrape**, visits all 60 book pages, turns messy HTML
into clean, checked JSON records, survives a broken page without crashing, and ends every
run with a short report of what happened.

## Target classification

- **Site**: Books to Scrape — https://books.toscrape.com
- **Why**: it is a public practice sandbox built explicitly so people can practise scraping
  on it (the site says so on its own pages). It is the only kind of site this assignment touches.
- **How much**: the first 3 catalogue pages only (~60 books). The crawler follows the site's
  own "next" link and stops after page 3 — book URLs are never hardcoded.
- **What data**: title, product URL, price, availability, star rating, description, source
  page, and fetch time for each book.
- **Appropriate here**: the site invites automated practice, we collect only what the task
  needs, we throttle and cache, and we identify ourselves.
- **robots.txt check**: requested `https://books.toscrape.com/robots.txt` once →
  **404, "no robots file found"**. A missing file is not permission; it is just a missing file.

> I will not reuse this code on another site without checking its rules and terms first.

## Run it

```bash
cd scraper
npm install
npm start
```

Outputs: `output/books.json` (60 validated records), `output/errors.json`,
`output/run-report.json` (see "Proof" below). Re-running produces the same 60 records —
the site is asked once per page, then everything reads from `cache/`.

## Lane

Node.js 20+ (built-in `fetch`), **Cheerio** for HTML parsing, **Zod** for schema validation.

## Record schema

| field | type | notes |
|-------|------|-------|
| title | string | required |
| product_url | string (URL) | canonical identity; duplicates count once |
| price_text | string | raw, e.g. `£51.77` |
| price_gbp | number | parsed from `price_text` |
| availability_text | string | raw |
| rating_text | string | e.g. `Three` |
| description | string \| null | `null` when the page has none — never invented |
| source_page | string (URL) | catalogue page the book was found on |
| fetched_at | string (ISO) | when the detail page was fetched |

## Politeness rules

- Identifying user-agent: `FlyRankInternshipA9/1.0 (+https://github.com/PSergio984/flyrank-capstone)`
- Timeout: 10 s per request (gives up; never waits forever)
- At least 500 ms between real requests to the site
- Status code checked before parsing — only 200 is a page
- Cache-first development: HTML saved under `cache/`; reruns read the cache, not the site
- One retry on timeout/5xx; 404 and 403 are never retried

## Failure handling

Each book page is fetched and extracted independently — one broken page is logged and
skipped; the other records survive. Invalid records (fail schema check) land in
`errors.json` with the reason, never in `books.json`.

## Proof

A real run (start time, duration, pages fetched, cache hits, valid/invalid records,
failed pages) is reported at the end of every run in `output/run-report.json`.

## Why no browser?

The data is already in the HTML the server sends — a browser would only add cost. See
`scripts/browser-compare.js` for the measurement (plain HTTP vs Playwright) behind that claim.

## Ethics note

Use an official API when one exists; never bypass logins, paywalls, or blocks; collect only
what you need. This scraper touches one practice sandbox, says who it is, and goes slowly.

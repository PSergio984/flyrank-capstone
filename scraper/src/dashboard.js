import { readFileSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Generate output/dashboard.html — a single self-contained page showing
 * record count, price range, failures, and data freshness. Opens from disk.
 */
export function writeDashboard({ booksPath, reportPath, outPath }) {
  const books = JSON.parse(readFileSync(booksPath, 'utf8'));
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));

  const prices = books.map((b) => b.price_gbp);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const total = prices.reduce((a, b) => a + b, 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>A9 scraper dashboard</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 720px; padding: 0 1rem; }
  h1 { font-size: 1.4rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 0.75rem 1rem; }
  .card .value { font-size: 1.6rem; font-weight: 600; }
  .card .label { color: #666; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .ok { color: #1a7f37; }
  .bad { color: #d1242f; }
</style>
</head>
<body>
<h1>Books to Scrape — run dashboard</h1>
<div class="cards">
  <div class="card"><div class="value">${books.length}</div><div class="label">records</div></div>
  <div class="card"><div class="value">&pound;${min.toFixed(2)} &ndash; &pound;${max.toFixed(2)}</div><div class="label">price range</div></div>
  <div class="card"><div class="value">${report.failed_pages}</div><div class="label">failed pages</div></div>
  <div class="card"><div class="value ${books.length > 0 ? 'ok' : 'bad'}">${report.start_time ? new Date(report.start_time).toLocaleString() : 'never'}</div><div class="label">last fresh</div></div>
</div>
<p>Run report: ${report.valid_records} valid, ${report.invalid_records} invalid, ${report.pages_fetched} pages fetched, ${report.cache_hits} cache hits, ${report.duration_ms} ms.</p>
</body>
</html>
`;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
}

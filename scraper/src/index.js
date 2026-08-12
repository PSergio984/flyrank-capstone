import { politeFetch } from './fetch.js';
import { discoverCatalogue } from './discover.js';
import { cachePathForBook, extractBook } from './extract.js';
import { priceToGbp } from './normalize.js';
import { storeRecords } from './store.js';
import { writeRunReport } from './report.js';
import { writeBooksCsv } from './csv.js';
import { writeDashboard } from './dashboard.js';

const startedAt = new Date();
const stats = { pagesFetched: 0, cacheHits: 0, failedPages: [] };
const fetchHtml = (url, opts) => politeFetch(url, { ...opts, stats });

const { links } = await discoverCatalogue(fetchHtml);

// Optional extra URLs injected via env (used to prove one bad page
// never kills the run): A9_EXTRA_URLS=https://books.toscrape.com/...
const extraUrls = (process.env.A9_EXTRA_URLS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((url) => ({ url, sourcePage: 'manual-test' }));

const records = [];
for (const link of [...links, ...extraUrls]) {
  try {
    const { html } = await fetchHtml(link.url, { cachePath: cachePathForBook(link.url) });
    const raw = extractBook(html, {
      productUrl: link.url,
      sourcePage: link.sourcePage,
      fetchedAt: new Date().toISOString(),
    });
    records.push({ ...raw, price_gbp: priceToGbp(raw.price_text) });
  } catch (err) {
    stats.failedPages.push({ url: link.url, error: err.message });
    console.log(`FAILED ${link.url}: ${err.message}`);
  }
}

console.log(`detail_pages=${records.length}`);
const store = storeRecords(records, {
  booksPath: 'output/books.json',
  errorsPath: 'output/errors.json',
});
console.log(`valid=${store.valid} invalid=${store.invalid}`);

writeBooksCsv(store.records, 'output/books.csv');

const reportPath = 'output/run-report.json';
writeRunReport(reportPath, {
  startedAt,
  durationMs: Date.now() - startedAt.getTime(),
  stats,
  store,
});
writeDashboard({ booksPath: 'output/books.json', reportPath, outPath: 'output/dashboard.html' });
console.log(`run-report.json: failed_pages=${stats.failedPages.length}`);

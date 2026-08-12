import { politeFetch } from './fetch.js';
import { discoverCatalogue } from './discover.js';
import { cachePathForBook, extractBook } from './extract.js';
import { priceToGbp } from './normalize.js';
import { storeRecords } from './store.js';

const stats = { pagesFetched: 0, cacheHits: 0 };
const fetchHtml = (url, opts) => politeFetch(url, { ...opts, stats });

const { links } = await discoverCatalogue(fetchHtml);

const records = [];
for (const link of links) {
  try {
    const { html } = await fetchHtml(link.url, { cachePath: cachePathForBook(link.url) });
    const raw = extractBook(html, {
      productUrl: link.url,
      sourcePage: link.sourcePage,
      fetchedAt: new Date().toISOString(),
    });
    records.push({ ...raw, price_gbp: priceToGbp(raw.price_text) });
  } catch (err) {
    console.log(`FAILED ${link.url}: ${err.message}`);
  }
}

console.log(`detail_pages=${records.length}`);
const { valid, invalid } = storeRecords(records, {
  booksPath: 'output/books.json',
  errorsPath: 'output/errors.json',
});
console.log(`valid=${valid} invalid=${invalid}`);

import { politeFetch } from './fetch.js';
import { discoverCatalogue } from './discover.js';
import { cachePathForBook, extractBook } from './extract.js';

const stats = { pagesFetched: 0, cacheHits: 0 };
const fetchHtml = (url, opts) => politeFetch(url, { ...opts, stats });

const { links } = await discoverCatalogue(fetchHtml);

const records = [];
for (const link of links) {
  try {
    const { html } = await fetchHtml(link.url, { cachePath: cachePathForBook(link.url) });
    records.push(extractBook(html, {
      productUrl: link.url,
      sourcePage: link.sourcePage,
      fetchedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.log(`FAILED ${link.url}: ${err.message}`);
  }
}

console.log(`detail_pages=${records.length}`);
console.log(JSON.stringify(records[0], null, 2));

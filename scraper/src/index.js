import { politeFetch } from './fetch.js';
import { discoverCatalogue } from './discover.js';

const stats = { pagesFetched: 0, cacheHits: 0 };
const fetchHtml = (url, opts) => politeFetch(url, { ...opts, stats });

const { pages, links } = await discoverCatalogue(fetchHtml);
const uniqueUrls = new Set(links.map((l) => l.url));

console.log(`catalogue_pages=${pages.length} discovered=${links.length} unique_urls=${uniqueUrls.size}`);
console.log(`pages fetched=${stats.pagesFetched} cache hits=${stats.cacheHits}`);

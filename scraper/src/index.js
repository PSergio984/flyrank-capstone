import { politeFetch } from './fetch.js';

const stats = { pagesFetched: 0, cacheHits: 0 };

const { html, fromCache } = await politeFetch('https://books.toscrape.com/catalogue/page-1.html', {
  cachePath: 'cache/catalogue-page-1.html',
  stats,
});

console.log(`response size: ${Buffer.byteLength(html)} bytes (${fromCache ? 'cache' : 'network'})`);
console.log(`stats: pagesFetched=${stats.pagesFetched} cacheHits=${stats.cacheHits}`);

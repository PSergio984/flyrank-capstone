import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractBook } from '../src/extract.js';
import { discoverCatalogue } from '../src/discover.js';

const fixture = (name) => readFileSync(`test/fixtures/${name}`, 'utf8');

test('extract: missing description yields null, never invented text', () => {
  const record = extractBook(fixture('book-missing-description.html'), {
    productUrl: 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html',
    sourcePage: 'https://books.toscrape.com/catalogue/page-1.html',
    fetchedAt: '2026-08-06T10:00:00Z',
  });
  assert.equal(record.title, 'A Light in the Attic');
  assert.equal(record.price_text, '£51.77');
  assert.equal(record.availability_text, 'In stock (22 available)');
  assert.equal(record.rating_text, 'Three');
  assert.equal(record.description, null);
  assert.equal(record.source_page, 'https://books.toscrape.com/catalogue/page-1.html');
});

test('extract: extra whitespace collapses, all eight keys present', () => {
  const record = extractBook(fixture('book-extra-whitespace.html'), {
    productUrl: 'https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html',
    sourcePage: 'https://books.toscrape.com/catalogue/page-1.html',
    fetchedAt: '2026-08-06T10:00:00Z',
  });
  assert.equal(record.title, 'Tipping the Velvet');
  assert.equal(record.price_text, '£53.74');
  assert.equal(record.availability_text, 'In stock (19 available)');
  assert.equal(record.rating_text, 'One');
  assert.match(record.description, /Sapphic erotica/);
  assert.deepEqual(Object.keys(record).sort(), [
    'availability_text', 'description', 'fetched_at', 'price_text',
    'product_url', 'rating_text', 'source_page', 'title',
  ].sort());
});

test('discover: follows next link, absolutizes and dedupes links', async () => {
  const calls = [];
  const fetchHtml = async (url, opts) => {
    calls.push(url);
    if (url.includes('page-2.html')) {
      return { html: '<html><body><div class="product_pod"><a href="../catalogue/another_1/index.html">x</a></div></body></html>' };
    }
    return { html: fixture('catalogue-page-1.html') };
  };
  const { pages, links } = await discoverCatalogue(fetchHtml);
  assert.equal(pages.length, 2);
  assert.equal(links.length, 4);
  assert.equal(links[0].url, 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html');
  assert.equal(links[0].sourcePage, 'https://books.toscrape.com/catalogue/page-1.html');
  assert.equal(new Set(links.map((l) => l.url)).size, 4);
});

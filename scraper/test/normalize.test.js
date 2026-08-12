import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceToGbp, dedupeByProductUrl } from '../src/normalize.js';

test('priceToGbp parses pounds', () => {
  assert.equal(priceToGbp('£51.77'), 51.77);
  assert.equal(priceToGbp('£1,000.99'), 1000.99);
  assert.equal(priceToGbp('£18.02'), 18.02);
});

test('priceToGbp returns NaN for non-prices', () => {
  assert.ok(Number.isNaN(priceToGbp('In stock')));
  assert.ok(Number.isNaN(priceToGbp('')));
  assert.ok(Number.isNaN(priceToGbp('n/a')));
});

test('dedupeByProductUrl keeps first occurrence only', () => {
  const records = [
    { product_url: 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html' },
    { product_url: 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html' },
    { product_url: 'https://books.toscrape.com/catalogue/other_1/index.html' },
  ];
  const unique = dedupeByProductUrl(records);
  assert.equal(unique.length, 2);
  assert.equal(unique[0].product_url, records[0].product_url);
  assert.equal(unique[1].product_url, records[2].product_url);
});

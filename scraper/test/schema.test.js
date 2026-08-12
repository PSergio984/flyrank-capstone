import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookSchema, validateRecord } from '../src/schema.js';

const goodRecord = {
  title: 'A Light in the Attic',
  product_url: 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html',
  price_text: '£51.77',
  price_gbp: 51.77,
  availability_text: 'In stock (22 available)',
  rating_text: 'Three',
  description: null,
  source_page: 'https://books.toscrape.com/catalogue/page-1.html',
  fetched_at: '2026-08-06T10:00:00Z',
};

test('valid record passes', () => {
  const result = validateRecord(goodRecord);
  assert.equal(result.ok, true);
});

test('description may be null (optional field)', () => {
  const result = validateRecord({ ...goodRecord, description: 'a real description' });
  assert.equal(result.ok, true);
});

test('missing required field fails with reason', () => {
  const { ok, reason } = validateRecord({ ...goodRecord, price_gbp: undefined });
  assert.equal(ok, false);
  assert.match(reason, /price_gbp/);
});

test('non-numeric price_gbp fails', () => {
  const { ok } = validateRecord({ ...goodRecord, price_gbp: '51.77' });
  assert.equal(ok, false);
});

test('schema requires every field listed', () => {
  const keys = Object.keys(bookSchema.shape).sort();
  assert.deepEqual(keys, [
    'availability_text', 'description', 'fetched_at', 'price_gbp', 'price_text',
    'product_url', 'rating_text', 'source_page', 'title',
  ].sort());
});

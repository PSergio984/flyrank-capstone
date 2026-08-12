import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateRecord } from './schema.js';
import { dedupeByProductUrl } from './normalize.js';

export function writeJson(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Validate every record, dedupe the good ones by product_url, and write
 * books.json (valid) + errors.json (invalid, with reasons).
 * Returns counts for the run report.
 */
export function storeRecords(records, { booksPath, errorsPath }) {
  const good = [];
  const errors = [];
  for (const record of records) {
    const validation = validateRecord(record);
    if (validation.ok) good.push(validation.record);
    else errors.push({ record, reason: validation.reason });
  }

  const unique = dedupeByProductUrl(good);
  writeJson(booksPath, unique);
  writeJson(errorsPath, errors);
  return { valid: unique.length, invalid: errors.length, records: unique };
}

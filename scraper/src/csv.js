import { writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { bookSchema } from './schema.js';

const FIELDS = Object.keys(bookSchema.shape);

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Export validated records to books.csv. Flattening: multi-line and
 * comma-bearing values are escaped; description whitespace collapses
 * to single spaces so one book stays one row.
 */
export function writeBooksCsv(records, filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  const header = FIELDS.join(',');
  const rows = records.map((r) => FIELDS.map((f) => csvEscape(r[f])).join(','));
  writeFileSync(filePath, [header, ...rows].join('\n') + '\n');
}

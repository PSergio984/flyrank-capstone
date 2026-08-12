/**
 * Parse "£51.77" (or "£1,000.99") into the number 51.77 (1000.99).
 * Returns NaN when the text is not a price.
 */
export function priceToGbp(priceText) {
  const digits = priceText.replace(/[£,\s]/g, '');
  const match = digits.match(/^(\d+(?:\.\d+)?)$/);
  return match ? Number(match[1]) : NaN;
}

/** The absolute product URL is the record's identity — duplicates count once. */
export function dedupeByProductUrl(records) {
  const seen = new Set();
  const unique = [];
  for (const record of records) {
    if (seen.has(record.product_url)) continue;
    seen.add(record.product_url);
    unique.push(record);
  }
  return unique;
}

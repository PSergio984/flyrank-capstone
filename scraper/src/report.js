import { writeJson } from './store.js';

/**
 * Write output/run-report.json — a few honest numbers so a silent
 * failure is noticed instead of being invisible for weeks.
 */
export function writeRunReport(reportPath, { startedAt, durationMs, stats, store }) {
  writeJson(reportPath, {
    start_time: startedAt.toISOString(),
    duration_ms: durationMs,
    pages_fetched: stats.pagesFetched,
    cache_hits: stats.cacheHits,
    valid_records: store.valid,
    invalid_records: store.invalid,
    failed_pages: stats.failedPages.length,
    failed_pages_detail: stats.failedPages,
  });
}

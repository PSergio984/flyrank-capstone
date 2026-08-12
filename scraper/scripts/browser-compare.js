import { performance } from 'node:perf_hooks';

const URL = 'https://quotes.toscrape.com/js';

/**
 * Stretch: browser cost comparison.
 * 1) Plain HTTP fetch — the quotes are NOT in the server's HTML (view the
 *    source first: the page ships a JavaScript shell that loads them after).
 * 2) Playwright headless browser — executes that JavaScript, quotes appear.
 * Measures wall time and peak memory (RSS) of both.
 */
const measureHttp = async () => {
  const rssBefore = process.memoryUsage().rss;
  const start = performance.now();
  const res = await fetch(URL, { headers: { 'user-agent': 'FlyRankInternshipA9/1.0 (+https://github.com/PSergio984/flyrank-capstone)' } });
  const html = await res.text();
  const ms = performance.now() - start;
  return {
    approach: 'plain HTTP fetch',
    status: res.status,
    time_ms: Math.round(ms),
    memory_mb: Math.round((process.memoryUsage().rss - rssBefore) / 1024 / 1024),
    quotes_in_html: html.includes('class="quote"'),
  };
};

const measureBrowser = async () => {
  const { chromium } = await import('playwright');
  const rssBefore = process.memoryUsage().rss;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const start = performance.now();
  await page.goto(URL, { waitUntil: 'networkidle' });
  const quoteCount = await page.locator('.quote').count();
  const ms = performance.now() - start;
  const memoryMb = Math.round((process.memoryUsage().rss - rssBefore) / 1024 / 1024);
  await browser.close();
  return {
    approach: 'Playwright (headless Chromium)',
    time_ms: Math.round(ms),
    memory_mb: memoryMb,
    quotes_in_html: quoteCount > 0,
  };
};

const http = await measureHttp();
console.log(JSON.stringify(http, null, 2));
const browser = await measureBrowser();
console.log(JSON.stringify(browser, null, 2));

const ratio = browser.time_ms / http.time_ms;
console.log(`\nPlain HTTP: ${http.time_ms} ms / ${http.memory_mb} MB — quotes in HTML: ${http.quotes_in_html}`);
console.log(`Playwright: ${browser.time_ms} ms / ${browser.memory_mb} MB — quotes in DOM: ${browser.quotes_in_html}`);
console.log(`Time ratio: ${ratio.toFixed(1)}x — the browser does ${ratio > 1 ? 'more' : 'less'} work for content the plain request never gets.`);

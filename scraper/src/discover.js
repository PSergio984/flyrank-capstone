import { load } from 'cheerio';

export const FIRST_PAGE = 'https://books.toscrape.com/catalogue/page-1.html';
export const MAX_CATALOGUE_PAGES = 3;

export const cachePathForCataloguePage = (index) => `cache/catalogue-page-${index}.html`;

/**
 * Walk the catalogue via its own "next" link, at most 3 pages deep.
 * Returns { pages, links } where pages = [{ url, cachePath }] and
 * links = [{ url, sourcePage }] — every book link absolutized, deduped.
 */
export async function discoverCatalogue(fetchHtml) {
  const pages = [];
  const links = [];
  let url = FIRST_PAGE;

  for (let pageIndex = 1; pageIndex <= MAX_CATALOGUE_PAGES; pageIndex++) {
    const { html } = await fetchHtml(url, { cachePath: cachePathForCataloguePage(pageIndex) });
    const page = { url, cachePath: cachePathForCataloguePage(pageIndex) };
    pages.push(page);

    const $ = load(html);
    $('.product_pod a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const bookUrl = new URL(href, page.url).href;
      if (!links.some((l) => l.url === bookUrl)) links.push({ url: bookUrl, sourcePage: page.url });
    });

    const nextHref = $('.next a').attr('href');
    if (!nextHref) break;
    url = new URL(nextHref, page.url).href;
  }

  return { pages, links };
}

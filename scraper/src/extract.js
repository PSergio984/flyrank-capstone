import { load } from 'cheerio';

export const cachePathForBook = (bookUrl) => {
  const slug = bookUrl.replace(/\/+$/, '').split('/').slice(-2).join('__').replace(/[^a-z0-9._-]/gi, '_');
  return `cache/books/${slug}.html`;
};

/**
 * Extract the raw record from a book detail page. Selectors are aimed at
 * the product area (.product_main / .availability), not the whole document.
 * description is null when the page has none — never invented.
 */
export function extractBook(html, { productUrl, sourcePage, fetchedAt }) {
  const $ = load(html);

  const title = $('.product_main h1').first().text().trim();
  const priceText = $('.product_main .price_color').first().text().trim();
  const availabilityText = $('.availability').first().text().replace(/\s+/g, ' ').trim();
  const ratingText = $('.product_main .star-rating').attr('class').split(/\s+/).filter((c) => c && c !== 'star-rating')[0] ?? null;
  const description = $('#product_description').next('p').first().text().trim() || null;

  return {
    title,
    product_url: productUrl,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: fetchedAt,
  };
}

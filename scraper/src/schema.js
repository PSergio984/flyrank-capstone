import { z } from 'zod';

export const bookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_text: z.string(),
  price_gbp: z.number(),
  availability_text: z.string(),
  rating_text: z.string(),
  description: z.string().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string(),
});

export function validateRecord(record) {
  const result = bookSchema.safeParse(record);
  if (result.success) return { ok: true, record: result.data };
  const reason = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { ok: false, reason };
}

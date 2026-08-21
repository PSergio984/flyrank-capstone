// Output contract for POST /enrich — the single source of truth.
// Mirrors JOB-CARD.md. Zod enums enforce closed output; strict() forbids extra fields.
// The model is untrusted external input — every reply must pass this before returning.
const { z } = require('zod');

// Canonical enums — closed lists from JOB-CARD. Never invent outside these.
const Category = z.enum(['work', 'personal', 'shopping', 'health', 'learning', 'other']);
const QualityFlag = z.enum([
  'vague_title',
  'too_short',
  'needs_details',
  'urgent_language',
  'duplicate_intent',
]);

// Input — validated before any LLM call (saves quota).
const inputSchema = z.object({
  text: z.string().trim().min(1, 'text is required and cannot be empty').max(2000, 'text must be 1-2000 characters'),
}).strict();

// Output — what we promise to callers and what we demand from the model.
// - summary is exactly one sentence, 1-120 chars (assignment + ticket #16)
// - confidence 0-1; when unsure -> other + <0.5 + needs_review true (not a guess)
// - quality_flags may be empty; never null
// - strict: extra fields fail validation (triggers repair once)
const outputSchema = z.object({
  category: Category,
  summary: z.string().trim().min(1).max(120),
  confidence: z.number().min(0).max(1),
  quality_flags: z.array(QualityFlag).default([]),
  needs_review: z.boolean(),
}).strict();

module.exports = { inputSchema, outputSchema, Category, QualityFlag };

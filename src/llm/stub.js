// Stub for POST /enrich — zero LLM calls, schema-valid, deterministic.
// Used when LLM_STUB=1. The assignment: "returns a hard-coded object that satisfies your schema."
// This is how you build every stage without burning quota.

function getStubEnrich(text) {
  // Keep it deterministic but still show input echo for demo (truncated to 100 for 120 limit)
  const summary = String(text).trim().slice(0, 100) || 'Stub summary';
  return {
    category: 'work',
    summary,
    confidence: 0.92,
    quality_flags: [],
    needs_review: false,
  };
}

module.exports = { getStubEnrich };

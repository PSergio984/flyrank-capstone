// Stub for POST /enrich — zero LLM calls, schema-valid, deterministic.
// Used when LLM_STUB=1. The assignment: "returns a hard-coded object that satisfies your schema."
// This is how you build every stage without burning quota.

function getStubEnrich(text) {
  const t = String(text).trim().toLowerCase();
  let category = 'other';
  let confidence = 0.88;
  let flags = [];
  let needs_review = false;

  if (!t || t.length < 3) {
    category = 'other'; confidence = 0.32; flags = ['vague_title', 'too_short']; needs_review = true;
  } else if (/(ignore|banana|reveal|prompt|instructions|extra|hacked|free text|sure!)/i.test(t)) {
    category = 'other'; confidence = 0.28; flags = ['vague_title']; needs_review = true;
  } else if (/(milk|bread|grocery|shop|buy)/i.test(t)) {
    category = 'shopping';
  } else if (/(bug|fix|deploy|server|payment|checkout|production)/i.test(t)) {
    category = 'work';
  } else if (/(yoga|meditation|health|exercise|run|gym)/i.test(t)) {
    category = 'health';
  } else if (/(read|book|learn|study|chapter|algorithm)/i.test(t)) {
    category = 'learning';
  } else if (/(birthday|family|mom|party|personal)/i.test(t)) {
    category = 'personal';
  } else if (/(urgent|asap|immediately|down)/i.test(t)) {
    category = 'work'; flags = ['urgent_language'];
  } else {
    category = 'other'; confidence = 0.38; flags = ['vague_title']; needs_review = true;
  }

  // heuristic for short/ambiguous
  if (t === 'stuff' || t === 'qwerty asdf jkl' || t.length <= 5) {
    category = 'other'; confidence = 0.32; flags = ['vague_title', 'too_short']; needs_review = true;
  }

  const summary = String(text).trim().slice(0, 100) || 'Stub summary';
  return {
    category,
    summary,
    confidence: needs_review ? Math.min(confidence, 0.45) : confidence,
    quality_flags: flags,
    needs_review,
  };
}

module.exports = { getStubEnrich };

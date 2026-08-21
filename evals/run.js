// Tiny eval — runs evals/cases.json through POST /enrich and prints score.
// Usage: LLM_STUB=1 node evals/run.js   (zero spend, uses stub)
//        node --env-file=.env evals/run.js  (real model, 8 calls)
// Requires API running at http://localhost:3000 (npm start or docker compose up).
// If API not running, falls back to direct stub+schema check so score still prints.
const fs = require('fs');
const path = require('path');

async function main() {
  const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
  const base = process.env.EVAL_BASE_URL || 'http://localhost:3000';
  let passed = 0;

  console.log(`Eval against ${base}/enrich — ${cases.length} cases (prompt ${process.env.LLM_MODEL || 'stub'})`);

  // Try HTTP if server reachable, else fall back to stub
  let useHttp = true;
  try {
    const probe = await fetch(`${base}/health`);
  } catch {
    // health may be 404 on fresh, try root
    try { await fetch(`${base}/`); } catch { useHttp = false; }
  }

  // If no server, fall back to direct stub validation (still measures schema, not model variance)
  if (!useHttp) {
    console.log('(API not reachable — falling back to direct stub check)');
    const { getStubEnrich } = require('../src/llm/stub');
    const { outputSchema } = require('../src/llm/schema');
    for (const c of cases) {
      const out = getStubEnrich(c.input.text);
      const parsed = outputSchema.safeParse(out);
      const ok = parsed.success && out.category === c.expected.category && out.needs_review === c.expected.needs_review;
      if (ok) passed++;
      else console.log(`FAIL #${c.id}: got ${JSON.stringify(out)} expected category=${c.expected.category}`);
    }
    console.log(`\nScore: ${passed}/${cases.length} (${((passed/cases.length)*100).toFixed(0)}%) — stub direct`);
    return;
  }

  for (const c of cases) {
    try {
      const res = await fetch(`${base}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c.input),
      });
      const body = await res.json();
      const got = body.category ?? body.raw?.category ?? null;
      const expected = c.expected.category;
      const confidenceOk = body.confidence == null || (body.confidence >= c.expected.confidence_range[0] && body.confidence <= c.expected.confidence_range[1]);
      const reviewOk = c.expected.needs_review === undefined || body.needs_review === c.expected.needs_review;
      const ok = res.ok && got === expected && confidenceOk && reviewOk;
      if (ok) passed++;
      else {
        console.log(`FAIL #${c.id} ${JSON.stringify(c.input)} -> ${JSON.stringify(body)} (expected category=${expected}, needs_review=${c.expected.needs_review})`);
      }
    } catch (e) {
      console.log(`ERROR #${c.id}: ${e.message}`);
    }
  }
  console.log(`\nScore: ${passed}/${cases.length} (${((passed/cases.length)*100).toFixed(0)}%)`);
  if (passed < cases.length) console.log('Failed ids: see above');
  // Record date+prompt version for README
  try {
    const { getPromptVersion } = require('../src/llm/prompt');
    console.log(`Date: ${new Date().toISOString().slice(0,10)}, prompt_version: ${getPromptVersion()}, model: ${process.env.LLM_MODEL || 'LLM_STUB=1 (stub)'}`);
  } catch {}
}

main();

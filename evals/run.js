// Tiny eval — runs evals/cases.json through POST /enrich and prints score.
// Usage: LLM_STUB=1 node evals/run.js   (zero spend, uses stub via HTTP)
//        node --env-file=.env evals/run.js  (real model, 8 calls)
// Requires API running at http://localhost:3000 (npm start or docker compose up).
// No fallback — must hit POST /enrich so score reflects the endpoint contract, not direct stub.
const fs = require('fs');
const path = require('path');

async function main() {
  const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
  const base = process.env.EVAL_BASE_URL || 'http://localhost:3000';
  let passed = 0;

  console.log(`Eval against ${base}/enrich — ${cases.length} cases (prompt ${process.env.LLM_MODEL || 'stub'})`);

  // Verify API reachable — no fallback (spec: 8 through your endpoint)
  try {
    await fetch(`${base}/health`);
  } catch {
    try { await fetch(`${base}/`); } catch (e) {
      console.error(`API not reachable at ${base} — start it first: npm start or docker compose up`);
      console.error(`Hint: with LLM_STUB=1 you can still test without a key, but the server must be running.`);
      process.exitCode = 2;
      return;
    }
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

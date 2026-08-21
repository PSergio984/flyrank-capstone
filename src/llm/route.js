// Enrich route — extracted to fix Divergent Change (index.js had two reasons to change)
// This is the LLM seam; Task API CRUD stays in index.js, LLM lifecycle lives here.
// One place that knows validation, stub, kill switch, cache, prompt, repair, quarantine, cost log.
const { inputSchema, outputSchema } = require('./schema');
const { getStubEnrich } = require('./stub');
const { getSystemPrompt, getPromptVersion } = require('./prompt');
const { createLlmClient, callWithRetry } = require('./client');
const { get: cacheGet, set: cacheSet } = require('./cache');
const { complete } = require('./provider');
const { logCost, quarantine } = require('./logger');

function extractJson(raw) {
  let text = String(raw ?? '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) text = fence[1];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) text = text.slice(start, end + 1);
  return text.trim();
}

function tryParseAndValidate(raw) {
  try {
    const jsonStr = extractJson(raw);
    const obj = JSON.parse(jsonStr);
    return outputSchema.safeParse(obj);
  } catch (e) {
    return { success: false, error: e, raw };
  }
}

async function handleEnrich(req, res) {
  const parsed = inputSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first.path.join('.') || 'text';
    return res.status(400).json({ error: `${field}: ${first.message}` });
  }

  const { text } = parsed.data;

  // Kill switch — checked FIRST so LLM_ENABLED=false wins even if LLM_STUB=1
  if (process.env.LLM_ENABLED === 'false') {
    return res.status(503).json({ error: 'LLM disabled', fallback: getStubEnrich(text) });
  }

  // Stub — zero LLM calls
  if (process.env.LLM_STUB === '1') {
    const stub = getStubEnrich(text);
    const checked = outputSchema.safeParse(stub);
    if (!checked.success) return res.status(500).json({ error: 'Stub failed output validation' });
    return res.json(checked.data);
  }

  // Bonus cache — prompt-versioned
  const promptVersion = getPromptVersion();
  const cached = cacheGet(text, promptVersion);
  if (cached) {
    logCost({ promptVersion, model: process.env.LLM_MODEL || 'cache', usage: null, durationMs: 0, repaired: false, cached: true });
    return res.json(cached);
  }

  // Real LLM path
  try {
    const systemPrompt = getSystemPrompt();
    const client = createLlmClient();
    const model = process.env.LLM_MODEL;

    if (!process.env.LLM_BASE_URL || !process.env.LLM_API_KEY || !model) {
      return res.status(500).json({ error: 'LLM not configured — set LLM_BASE_URL/API_KEY/MODEL' });
    }

    const first = await complete({ system: systemPrompt, user: text });
    let raw = first.content ?? '';
    let usage = first.usage || null;
    let durationMs = first.duration || 0;
    let result = tryParseAndValidate(raw);
    let repaired = false;
    let repairDuration = 0;

    if (!result.success) {
      const errMsg = result.error?.issues ? result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : String(result.error?.message || result.error);
      const repairSystem = systemPrompt + `\n\nYour previous answer was rejected for this reason: ${errMsg}. Return only corrected JSON matching the schema.`;
      try {
        const repair = await callWithRetry(client, {
          model,
          messages: [
            { role: 'system', content: repairSystem },
            { role: 'user', content: JSON.stringify(text) },
            { role: 'assistant', content: raw },
            { role: 'user', content: `Validation error: ${errMsg}. Return only corrected JSON.` },
          ],
          temperature: 0,
        });
        const repairRes = repair.res;
        repairDuration = repair.duration;
        const repairRaw = repairRes.choices?.[0]?.message?.content ?? '';
        const repairResult = tryParseAndValidate(repairRaw);
        if (repairResult.success) {
          result = repairResult;
          repaired = true;
          usage = repairRes.usage || usage;
          raw = repairRaw;
        } else {
          result = repairResult;
        }
      } catch (e) {}
      if (!result.success) {
        quarantine({ input: text, raw_output: raw, validation_error: errMsg, prompt_version: promptVersion });
        logCost({ promptVersion, model, usage, durationMs: durationMs + repairDuration, repaired, cached: false });
        return res.status(422).json({ error: 'Invalid model output', details: errMsg });
      }
    }

    logCost({ promptVersion, model, usage, durationMs: repaired ? durationMs + repairDuration : durationMs, repaired, cached: false });
    try { cacheSet(text, promptVersion, result.data); } catch (e) {}
    return res.json(result.data);
  } catch (err) {
    const status = err.status || 500;
    if (status === 401) return res.status(500).json({ error: 'LLM auth failed — check LLM_API_KEY' });
    if (err.name === 'APIConnectionTimeoutError' || status === 504) return res.status(504).json({ error: 'LLM timeout' });
    if (status === 429) return res.status(429).json({ error: 'LLM rate limited', retry_after: err.headers?.get?.('retry-after') });
    console.error('LLM call failed', err);
    return res.status(500).json({ error: 'LLM call failed', details: err.message });
  }
}

module.exports = { handleEnrich, extractJson, tryParseAndValidate };

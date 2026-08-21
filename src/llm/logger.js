// Shared logger for LLM calls — extracts duplicated cost/quarantine blocks
// One place that knows file paths and JSONL shape, so index.js doesn't repeat.
const fs = require('fs');
const path = require('path');

function appendJsonl(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}

function logCost({ promptVersion, model, usage, durationMs, repaired, cached }) {
  const file = path.join(__dirname, '..', '..', 'logs', 'llm.jsonl');
  const entry = {
    timestamp: new Date().toISOString(),
    prompt_version: promptVersion,
    model: model || 'unknown',
    input_tokens: usage?.prompt_tokens ?? 0,
    output_tokens: usage?.completion_tokens ?? 0,
    duration_ms: durationMs,
    repair: repaired ? 1 : 0,
    cached: !!cached,
  };
  try { appendJsonl(file, entry); } catch (e) { /* log failure not fatal */ }
}

function quarantine({ input, raw_output, validation_error, prompt_version }) {
  const file = path.join(__dirname, '..', '..', 'logs', 'quarantine.jsonl');
  const entry = { timestamp: new Date().toISOString(), input, raw_output, validation_error, prompt_version };
  try { appendJsonl(file, entry); } catch (e) { console.error('quarantine write failed', e); }
}

module.exports = { logCost, quarantine };

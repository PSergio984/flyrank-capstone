// Prompt loader — prompts are code (versioned, diffable), not strings in handlers.
// Loads prompts/enrich-v1.md as the system prompt. User content stays in role:user, JSON-encoded.
const fs = require('fs');
const path = require('path');

let cachedPrompt = null;
let promptVersion = 'enrich-v1';

function loadPrompt(version = promptVersion) {
  const file = path.join(__dirname, '..', '..', 'prompts', `${version}.md`);
  const content = fs.readFileSync(file, 'utf8');
  cachedPrompt = content;
  promptVersion = version;
  return content;
}

function getSystemPrompt() {
  if (!cachedPrompt) return loadPrompt();
  return cachedPrompt;
}

function getPromptVersion() {
  return promptVersion;
}

module.exports = { loadPrompt, getSystemPrompt, getPromptVersion };

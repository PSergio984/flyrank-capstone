// Simple in-memory cache for POST /enrich — key = sha256(input + promptVersion)
// Assignment: "Keep a small in-memory cache: hash the input plus the prompt version,
// and if you have seen that exact request before, return the saved answer instead of calling the model."
// Worth when same inputs repeat (normalizing vocab, re-enriching scraped records, saving quota);
// not much when every input unique. Key must include prompt version — changing prompt makes yesterday's answers stale.
const crypto = require('crypto');

const MAX = 100;
const cache = new Map(); // insertion-order = LRU via re-insert on hit

function cacheKey(text, promptVersion) {
  return crypto.createHash('sha256').update(`${promptVersion}::${text}`).digest('hex');
}

function get(text, promptVersion) {
  const key = cacheKey(text, promptVersion);
  const hit = cache.get(key);
  if (hit) {
    // LRU: re-insert to move to end
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  return null;
}

function set(text, promptVersion, value) {
  const key = cacheKey(text, promptVersion);
  if (cache.size >= MAX) {
    // evict oldest
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(key, value);
}

function clear() { cache.clear(); }

module.exports = { cacheKey, get, set, clear, _map: cache };

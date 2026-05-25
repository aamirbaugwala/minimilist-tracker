/**
 * agentCache.js
 *
 * Lightweight in-memory TTL cache for the AI agent's tool results.
 * Runs at module level — shared across all warm Vercel Lambda invocations
 * for the same container, giving meaningful cache hits within a user session.
 *
 * Cached tools & their TTLs:
 *   get_user_profile    → 5 minutes  (profile rarely changes mid-session)
 *   get_medical_context → 60 minutes (only changes on new report upload)
 *
 * Cache is intentionally NOT used for:
 *   get_todays_logs / get_macro_gap / get_streak — change every food log
 *   get_logs_for_days / get_weight_trend         — time-series, needs freshness
 *   log_food_item / update_goal / save_food_to_database — write operations
 *   search_food_database — already reads from in-memory FLATTENED_DB, no DB cost
 *
 * Key format: `${userId}:${toolName}`
 * Safe: each entry is keyed by userId — no cross-user data leakage possible.
 */

const TTL = {
  get_user_profile:    5  * 60 * 1000,  // 5 minutes
  get_medical_context: 60 * 60 * 1000,  // 60 minutes
};

// Module-level store — persists across warm Lambda invocations
const store = new Map(); // key → { value, expiresAt }

/**
 * Get a cached tool result.
 * Returns the cached value or null if missing / expired.
 */
export function cacheGet(userId, toolName) {
  const key   = `${userId}:${toolName}`;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Store a tool result in the cache.
 * Only caches tools that are in the TTL map — silently skips others.
 */
export function cacheSet(userId, toolName, value) {
  const ttl = TTL[toolName];
  if (!ttl) return; // tool not in whitelist — don't cache
  store.set(`${userId}:${toolName}`, {
    value,
    expiresAt: Date.now() + ttl,
  });
}

/**
 * Invalidate one or more tool caches for a user.
 * Call this after any write operation that makes cached data stale.
 * e.g. after update_goal → invalidate get_user_profile
 *      after uploading a medical report → invalidate get_medical_context
 */
export function cacheInvalidate(userId, ...toolNames) {
  for (const toolName of toolNames) {
    store.delete(`${userId}:${toolName}`);
  }
}

/**
 * Returns current cache stats — useful for debugging.
 */
export function cacheStats() {
  const now = Date.now();
  let alive = 0;
  let expired = 0;
  store.forEach((entry) => {
    if (now > entry.expiresAt) { expired++; } else { alive++; }
  });
  return { totalEntries: store.size, alive, expired };
}

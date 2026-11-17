/**
 * RFC 4122 v4 UUID that works everywhere the app runs.
 *
 * crypto.randomUUID() only exists in SECURE contexts (https / localhost). On
 * plain-http pages — e.g. the dev server opened from a phone over Wi-Fi — it's
 * undefined, and the old fallback ("id_<time>_<rand>") was rejected by the
 * uuid primary key, so every food/water log failed with a 400.
 * crypto.getRandomValues() IS available on insecure pages, so build one from it.
 */
export function uuid() {
  const c = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) {
    try {
      return c.randomUUID();
    } catch {
      /* insecure context in some browsers throws instead of being undefined */
    }
  }
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

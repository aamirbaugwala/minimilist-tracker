"use client";

/**
 * useLocalStorageValue(key) → [value, setValue]
 *
 * localStorage as an external store (useSyncExternalStore), so components read
 * it during render without effect-then-setState cascades, stay in sync across
 * components/tabs, and hydrate safely: on the server (and the first client
 * render) the value is `undefined` = "not known yet" — callers should treat it
 * as "don't show" to avoid a flash. Falls back to memory when storage is
 * blocked (private mode), so dismissals still hold for the session.
 */

import { useCallback, useSyncExternalStore } from "react";

const EVT = "nt-local-storage";
const memory = new Map();

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.has(key) ? memory.get(key) : null;
  }
}

export function useLocalStorageValue(key) {
  const subscribe = useCallback(
    (onChange) => {
      const onLocal = (e) => {
        if (!e.detail || e.detail === key) onChange();
      };
      window.addEventListener(EVT, onLocal);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(EVT, onLocal);
        window.removeEventListener("storage", onChange);
      };
    },
    [key],
  );

  const value = useSyncExternalStore(subscribe, () => read(key), () => undefined);

  const setValue = useCallback(
    (v) => {
      try {
        if (v == null) localStorage.removeItem(key);
        else localStorage.setItem(key, String(v));
      } catch {
        if (v == null) memory.delete(key);
        else memory.set(key, String(v));
      }
      window.dispatchEvent(new CustomEvent(EVT, { detail: key }));
    },
    [key],
  );

  return [value, setValue];
}

"use client";

/**
 * PageHeader — the one header every secondary screen uses, so back
 * behaviour, spacing and the sticky blur look the same everywhere.
 *
 * Rules of thumb:
 *  - Tab-root screens (the ones in the bottom nav) pass no `back`: the tab bar
 *    is how you leave them.
 *  - Sub-screens pass `back="/parent"`: Back steps back through in-app
 *    history when there is any, and otherwise goes to that parent (deep link,
 *    PWA launch, notification tap), so Back never exits the app.
 *
 * Props:
 *   title, subtitle   text
 *   icon              a rendered icon element (optional)
 *   back              fallback parent href; omit for no back button
 *   onBack            optional hook run before navigating back (e.g. cleanup)
 *   actions           right-aligned buttons
 *   children          rendered under the title row (e.g. <SegmentedTabs/>)
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { canGoBack } from "../lib/navHistory";

export function useSmartBack(fallback = "/") {
  const router = useRouter();
  return useCallback(() => {
    if (canGoBack()) router.back();
    else router.push(fallback);
  }, [router, fallback]);
}

export default function PageHeader({
  title,
  subtitle,
  icon,
  back,
  onBack,
  actions,
  children,
}) {
  const goBack = useSmartBack(back || "/");

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "color-mix(in srgb, var(--bg) 90%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--border)",
        padding: "calc(12px + env(safe-area-inset-top, 0px)) 16px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 36 }}>
        {back && (
          <button
            onClick={() => {
              onBack?.();
              goBack();
            }}
            aria-label="Back"
            style={{
              width: 36,
              height: 36,
              marginLeft: -6,
              borderRadius: 10,
              border: "none",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {icon && <span style={{ display: "flex", flexShrink: 0 }}>{icon}</span>}

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 600,
              color: "var(--text)",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginTop: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {actions && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>

      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </header>
  );
}

/** Full-width segmented control for switching views inside one screen. */
// `accent` is accepted for backwards compatibility but no longer used —
// Direction A tabs are neutral (a quiet raised chip marks the selection).
export function SegmentedTabs({ tabs, value, onChange }) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        borderRadius: 12,
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {tabs.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            style={{
              flex: 1,
              padding: "8px 6px",
              borderRadius: 9,
              border: "none",
              background: active ? "var(--surface-highlight)" : "transparent",
              color: active ? "var(--text)" : "var(--text-muted)",
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Small secondary button for the header's `actions` slot. */
export const headerActionStyle = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 11px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

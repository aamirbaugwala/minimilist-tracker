"use client";

/**
 * Horizontal panel selector for the trends screen.
 *
 * Replaces the stacked accordions this page used to have: those nested a panel
 * box around a marker card around an expanded timeline — three levels of
 * borders. Chips flatten that to one level and match the scrollable category
 * row already used on the home screen, so the interaction is familiar.
 *
 * An amber dot marks panels containing an abnormal marker, so problems are
 * visible without opening anything.
 */
export default function PanelTabs({ groups, selected, onSelect, totalMarkers, totalAbnormal }) {
  const chips = [
    { id: "all", label: "All", count: totalMarkers, abnormal: totalAbnormal, color: "#6366f1" },
    ...groups.map((g) => ({
      id: g.panel.id,
      label: g.panel.label,
      count: g.markers.length,
      abnormal: g.abnormalCount,
      color: g.panel.color,
    })),
  ];

  return (
    <div
      className="category-scroll-row"
      style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}
    >
      {chips.map((chip) => {
        const active = selected === chip.id;
        return (
          <button
            key={chip.id}
            onClick={() => onSelect(chip.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
              // Comfortable thumb target on a phone.
              padding: "9px 14px",
              minHeight: 38,
              borderRadius: 20,
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: active ? 700 : 500,
              whiteSpace: "nowrap",
              transition: "all 0.15s",
              border: `1px solid ${active ? chip.color : "#1e1e26"}`,
              background: active ? `${chip.color}1f` : "#111116",
              color: active ? "#fff" : "#71717a",
            }}
          >
            {chip.label}
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: active ? chip.color : "#3f3f46",
              }}
            >
              {chip.count}
            </span>
            {chip.abnormal > 0 && (
              <span
                title={`${chip.abnormal} abnormal`}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#f59e0b",
                  flexShrink: 0,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

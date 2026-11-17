"use client";

/**
 * Water + weight — a compact row right under the calorie hero (Direction A).
 * Lives near the top on purpose: at the bottom of Today it sank below a full
 * day's food log. Each half is one line: label + value, and a quick action.
 * Weight expands into an inline input in place.
 */

import { useState } from "react";
import { Loader2, Plus, Check, X } from "lucide-react";
import { calculateTargets } from "../lib/nutrition";

const tile = {
  minWidth: 0,
  minHeight: 56,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 8px 8px 14px",
  borderRadius: 14,
  background: "var(--surface)",
  border: "1px solid var(--border)",
};
const iconBtn = {
  width: 36,
  height: 36,
  flexShrink: 0,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};
const label = { fontSize: 12, color: "var(--text-muted)" };
const value = { fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const unit = { fontSize: 12, color: "var(--text-faint)", fontWeight: 400 };

export default function BodyTiles({
  totals,
  userProfile,
  conditions,
  onAddWater,
  weightInput,
  setWeightInput,
  onSaveWeight,
  savingWeight,
}) {
  const [editingWeight, setEditingWeight] = useState(false);
  const waterTarget = calculateTargets(userProfile, conditions).water;
  // totals.water counts GLASSES (0.25 L each), not litres
  const litres = ((totals.water || 0) * 0.25).toFixed(1);

  const save = async () => {
    if (!weightInput) return;
    const ok = await onSaveWeight();
    if (ok !== false) setEditingWeight(false);
  };
  const cancel = () => {
    setEditingWeight(false);
    setWeightInput("");
  };

  return (
    <section aria-label="Water and weight" style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
      <div style={tile}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={label}>Water</div>
          <div style={value}>
            {litres}
            <span style={unit}> / {waterTarget} L</span>
          </div>
        </div>
        <button onClick={onAddWater} aria-label="Add a glass of water" title="Add a glass (250 ml)" style={iconBtn}>
          <Plus size={16} />
        </button>
      </div>

      <div style={tile}>
        {!editingWeight ? (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={label}>Weight</div>
              <div style={value}>
                {userProfile?.weight || "--"}
                <span style={unit}> kg</span>
              </div>
            </div>
            <button
              onClick={() => setEditingWeight(true)}
              style={{ ...iconBtn, width: "auto", padding: "0 12px", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}
            >
              Log
            </button>
          </>
        ) : (
          <>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              autoFocus
              aria-label="Today's weight in kg"
              placeholder={userProfile?.weight ? `${userProfile.weight}` : "kg"}
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
              style={{
                flex: 1,
                minWidth: 0,
                height: 36,
                padding: "0 8px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
                font: "inherit",
                fontSize: 15,
                outline: "none",
              }}
            />
            <button
              onClick={save}
              disabled={savingWeight || !weightInput}
              aria-label="Save weight"
              style={{ ...iconBtn, border: "none", background: "var(--accent)", color: "var(--on-accent)", opacity: weightInput ? 1 : 0.5 }}
            >
              {savingWeight ? <Loader2 size={15} className="animate-spin" /> : <Check size={16} strokeWidth={2.4} />}
            </button>
            <button onClick={cancel} aria-label="Cancel" style={{ ...iconBtn, width: 28, border: "none", color: "var(--text-faint)" }}>
              <X size={15} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

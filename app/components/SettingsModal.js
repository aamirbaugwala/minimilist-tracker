"use client";

/**
 * Profile & goals (Direction A) — one sheet, two tabs:
 *   Profile & goals: body stats, activity, goal presets, fine-tuning
 *                    (calorie adjustment, protein priority, exact target),
 *                    diet & health, medical caps/conflicts, live daily target.
 *   Account:         username and password.
 * Same props as before, so Today and Me use it unchanged.
 */

import { AlertTriangle, Info } from "lucide-react";
import { calculateTargets, GOAL_PRESETS } from "../lib/nutrition";
import HealthProfileFields from "./HealthProfileFields";
import Sheet, { sheetInput, sheetLabel, primaryBtn } from "./Sheet";

const ACTIVITY = [
  { id: "sedentary", label: "Desk" },
  { id: "light", label: "Light" },
  { id: "moderate", label: "Moderate" },
  { id: "active", label: "Active" },
];
const PRIORITY = [
  { id: "preserve", label: "Preserve", hint: "2.0 g/kg · keep muscle in a deficit" },
  { id: "balanced", label: "Balanced", hint: "1.8 g/kg · standard for most goals" },
  { id: "maximize", label: "Maximize", hint: "2.4 g/kg · building or recomposition" },
];
const fmt = (n) => Math.round(n || 0).toLocaleString("en-IN");

function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, padding: 3, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          style={{ height: 34, border: "none", borderRadius: 9, background: value === o.id ? "var(--surface-highlight)" : "none", color: value === o.id ? "var(--text)" : "var(--text-muted)", fontFamily: "inherit", fontSize: 13, fontWeight: value === o.id ? 600 : 400, cursor: "pointer" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const section = { display: "flex", flexDirection: "column", gap: 8 };
const sectionTitle = { fontSize: 13, color: "var(--text-muted)" };

export default function SettingsModal({
  conditions = [],
  setIsSettingGoal,
  settingsTab,
  setSettingsTab,
  userProfile,
  setUserProfile,
  username,
  setUsername,
  newPassword,
  setNewPassword,
  handleUpdatePassword,
  saveGoal,
}) {
  const p = userProfile || {};
  const set = (patch) => setUserProfile({ ...p, ...patch });
  const preview = calculateTargets(p, conditions);
  const { conflicts = [], adjustments = [] } = preview.medical || {};
  const adj = p.calorie_adjustment ?? 0;
  const onAccount = settingsTab === "security";

  const num = (key, label, unit) => (
    <label style={{ ...sheetLabel, fontSize: 12, gap: 4 }}>
      {label}
      <div style={{ position: "relative" }}>
        <input
          inputMode="decimal"
          value={p[key] ?? ""}
          onChange={(e) => set({ [key]: e.target.value })}
          aria-label={`${label}${unit ? ` in ${unit}` : ""}`}
          style={{ ...sheetInput, height: 44, paddingRight: unit ? 34 : 14 }}
        />
        {unit && <span style={{ position: "absolute", right: 12, top: 13, fontSize: 12, color: "var(--text-faint)" }}>{unit}</span>}
      </div>
    </label>
  );

  return (
    <Sheet
      title={onAccount ? "Account" : "Profile & goals"}
      onClose={() => setIsSettingGoal(false)}
      tall
      footer={
        onAccount ? (
          <button onClick={handleUpdatePassword} style={{ ...primaryBtn, flex: 1 }}>Save account</button>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Daily target</span>
              <span style={{ fontSize: 15, fontWeight: 600, textAlign: "right" }}>
                {fmt(preview.cals)} kcal · P {fmt(preview.p)} · C {fmt(preview.c)} · F {fmt(preview.f)}
              </span>
            </div>
            {conflicts[0] && <div style={{ fontSize: 12, color: "var(--warn)" }}>{conflicts[0].title}</div>}
            <button onClick={saveGoal} style={primaryBtn}>Save</button>
          </div>
        )
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div role="tablist" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", padding: 3, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
          {[
            ["profile", "Profile & goals"],
            ["security", "Account"],
          ].map(([id, label]) => {
            const active = (id === "security") === onAccount;
            return (
              <button key={id} role="tab" aria-selected={active} onClick={() => setSettingsTab(id)} style={{ height: 34, border: "none", borderRadius: 9, background: active ? "var(--surface-highlight)" : "none", color: active ? "var(--text)" : "var(--text-muted)", fontFamily: "inherit", fontSize: 14, fontWeight: active ? 600 : 400, cursor: "pointer" }}>
                {label}
              </button>
            );
          })}
        </div>

        {onAccount ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={sheetLabel}>
              Username
              <input value={username || ""} onChange={(e) => setUsername(e.target.value)} placeholder="Shown to friends on Social" autoComplete="username" style={sheetInput} />
            </label>
            <label style={sheetLabel}>
              New password
              <input type="password" value={newPassword || ""} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave empty to keep your current one" autoComplete="new-password" style={sheetInput} />
            </label>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>A password lets you sign in without an email code.</p>
          </div>
        ) : (
          <>
            <div style={section}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {num("weight", "Weight", "kg")}
                {num("height", "Height", "cm")}
                {num("age", "Age")}
              </div>
              <Segmented label="Sex" options={[{ id: "male", label: "Male" }, { id: "female", label: "Female" }]} value={p.gender} onChange={(g) => set({ gender: g })} />
            </div>

            <div style={section}>
              <div style={sectionTitle}>Activity</div>
              <Segmented label="Activity" options={ACTIVITY} value={p.activity} onChange={(a) => set({ activity: a })} />
            </div>

            <div style={section}>
              <div style={sectionTitle}>Goal</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {GOAL_PRESETS.map((g) => {
                  const on = p.goal === g.id;
                  return (
                    <button
                      key={g.id}
                      aria-pressed={on}
                      title={g.desc}
                      onClick={() => set({ goal: g.id, calorie_adjustment: g.calorie_adjustment, protein_priority: g.protein_priority })}
                      style={{ padding: "8px 14px", borderRadius: 99, border: on ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: on ? "var(--accent-soft)" : "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 14, fontWeight: on ? 600 : 400, cursor: "pointer" }}
                    >
                      {g.label}
                    </button>
                  );
                })}
                {p.goal === "custom" && (
                  <span style={{ padding: "8px 14px", borderRadius: 99, border: "1.5px solid var(--accent)", background: "var(--accent-soft)", fontSize: 14, fontWeight: 600 }}>Custom</span>
                )}
              </div>
            </div>

            <div style={section}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>Calorie adjustment</span>
                <span style={{ fontWeight: 600 }}>{adj > 0 ? "+" : ""}{adj} kcal</span>
              </div>
              <input
                type="range"
                min="-700"
                max="500"
                step="50"
                value={adj}
                onChange={(e) => set({ calorie_adjustment: Number(e.target.value), goal: "custom" })}
                aria-label="Calorie adjustment from maintenance"
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-faint)" }}>
                <span>−700 · lose</span><span>maintain</span><span>+500 · gain</span>
              </div>
            </div>

            <div style={section}>
              <div style={sectionTitle}>Protein priority</div>
              <Segmented label="Protein priority" options={PRIORITY} value={p.protein_priority || "balanced"} onChange={(id) => set({ protein_priority: id })} />
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{PRIORITY.find((x) => x.id === (p.protein_priority || "balanced"))?.hint}</div>
            </div>

            <label style={sheetLabel}>
              Exact daily target (optional)
              <input
                inputMode="numeric"
                value={p.target_calories || ""}
                onChange={(e) => set({ target_calories: e.target.value })}
                placeholder="Leave empty to calculate from your goal"
                style={sheetInput}
              />
            </label>

            <div style={section}>
              <div style={sectionTitle}>Diet &amp; health</div>
              <HealthProfileFields profile={p} onChange={setUserProfile} />
            </div>

            {(conflicts.length > 0 || adjustments.length > 0) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {conflicts.map((c) => (
                  <div key={c.title} style={{ display: "flex", gap: 10, padding: 12, borderRadius: 12, background: "var(--warn-soft)", fontSize: 13, lineHeight: 1.5 }}>
                    <AlertTriangle size={16} color="var(--warn)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span><strong style={{ color: "var(--warn)" }}>{c.title}.</strong> {c.detail}</span>
                  </div>
                ))}
                {adjustments.map((a) => (
                  <div key={a.title} style={{ display: "flex", gap: 10, padding: 12, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
                    <Info size={16} color="var(--accent-text)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span><strong style={{ color: "var(--text)" }}>{a.title}.</strong> {a.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

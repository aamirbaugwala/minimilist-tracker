"use client";

/**
 * The pop-ups that open from Today, all on the shared <Sheet> (Direction A):
 *   EditLogSheet     — amount (stepper + ½/1/1½/2), live macros, move to
 *                      another meal, delete / save
 *   CustomFoodSheet  — name, serving, 5 nutrients, "also add 1 to <meal>"
 *   MealBuilderSheet — name a saved meal, add foods with steppers, total
 */

import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import Sheet, { sheetInput, sheetLabel, primaryBtn, dangerBtn } from "./Sheet";
import { MEALS } from "../lib/mealPeriod";

const r = (n) => Math.round(Number(n) || 0);
const fmtQty = (q) => (q === 0.5 ? "½" : q === 1.5 ? "1½" : String(q));
const stepUp = (q) => (q < 1 ? 1 : Math.round((q + 1) * 2) / 2);
const stepDown = (q) => (q > 1 ? Math.round((q - 1) * 2) / 2 : q === 1 ? 0.5 : 0.5);

function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, padding: 3, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          style={{ height: 34, border: "none", borderRadius: 9, background: value === o ? "var(--surface-highlight)" : "none", color: value === o ? "var(--text)" : "var(--text-muted)", fontFamily: "inherit", fontSize: 13, fontWeight: value === o ? 600 : 400, cursor: "pointer" }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function EditLogSheet({ log, qty, setQty, meal, setMeal, onSave, onDelete, onClose }) {
  const q = Number(qty) || 0;
  const ratio = log.qty ? q / log.qty : 0;
  const { title, serving } = (() => {
    const s = String(log.name || "");
    const i = s.indexOf("(");
    return { title: (i > 0 ? s.slice(0, i) : s).trim(), serving: i > 0 ? s.slice(i + 1).replace(/\)\s*$/, "") : "" };
  })();

  return (
    <Sheet
      title={<span style={{ textTransform: "capitalize" }}>{title}</span>}
      label={`Edit ${title}`}
      subtitle={`Edit entry · ${log.meal || meal}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onDelete} style={dangerBtn}>Delete</button>
          <button onClick={onSave} style={{ ...primaryBtn, flex: 1 }}>Save</button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <button onClick={() => setQty(stepDown(q))} aria-label="Less" style={{ width: 48, height: 48, borderRadius: 14, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 24, cursor: "pointer" }}>−</button>
          <div style={{ textAlign: "center" }}>
            <div aria-live="polite" style={{ fontSize: 34, fontWeight: 600, letterSpacing: -1 }}>{fmtQty(q)}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{serving ? `× ${serving}` : "servings"}</div>
          </div>
          <button onClick={() => setQty(stepUp(q))} aria-label="More" style={{ width: 48, height: 48, borderRadius: 14, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 24, cursor: "pointer" }}>+</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          {[0.5, 1, 1.5, 2].map((v) => (
            <button
              key={v}
              onClick={() => setQty(v)}
              aria-pressed={q === v}
              style={{ height: 38, borderRadius: 10, border: q === v ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: q === v ? "var(--accent-soft)" : "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 14, fontWeight: q === v ? 600 : 400, cursor: "pointer" }}
            >
              {fmtQty(v)}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", textAlign: "center" }}>
          {[
            [r(log.calories * ratio), "kcal"],
            [`${r(log.protein * ratio)} g`, "protein"],
            [`${r(log.carbs * ratio)} g`, "carbs"],
            [`${r(log.fats * ratio)} g`, "fat"],
          ].map(([v, l]) => (
            <div key={l}><div style={{ fontSize: 17, fontWeight: 600 }}>{v}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>{l}</div></div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Meal</div>
          <Segmented label="Meal" options={MEALS.map((m) => m.label)} value={meal} onChange={setMeal} />
        </div>
      </div>
    </Sheet>
  );
}

export function CustomFoodSheet({ food, setFood, addNow, setAddNow, meal, onSubmit, onClose }) {
  const field = (key, label) => (
    <label key={key} style={{ ...sheetLabel, fontSize: 11, textAlign: "center", gap: 4 }}>
      {label}
      <input
        inputMode="decimal"
        value={food[key]}
        onChange={(e) => setFood({ ...food, [key]: e.target.value })}
        style={{ ...sheetInput, height: 44, padding: 0, textAlign: "center", minWidth: 0 }}
      />
    </label>
  );
  return (
    <Sheet
      title="Create a food"
      onClose={onClose}
      footer={<button onClick={onSubmit} style={{ ...primaryBtn, flex: 1 }}>Save food</button>}
    >
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={sheetLabel}>
          Name
          <input autoFocus value={food.name} onChange={(e) => setFood({ ...food, name: e.target.value })} placeholder="e.g. Mom’s methi thepla" style={sheetInput} />
        </label>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Per serving</span>
            <Link href="/agent" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-text)", textDecoration: "none" }}>Not sure? Ask Coach</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
            {field("calories", "kcal")}
            {field("protein", "Protein")}
            {field("carbs", "Carbs")}
            {field("fats", "Fat")}
            {field("fiber", "Fibre")}
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, border: "1px solid var(--border)", fontSize: 15, cursor: "pointer" }}>
          <input type="checkbox" checked={addNow} onChange={(e) => setAddNow(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--accent)" }} />
          <span style={{ flex: 1 }}>Also add 1 to {meal} now</span>
        </label>
        <div style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>Saved foods show up in search and Recent next time.</div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}

export function MealBuilderSheet({ editing, name, setName, items, foodDb, query, setQuery, suggestions, onAdd, onRemove, onQty, onSave, onClose }) {
  const kcalOf = (i) => (Number(foodDb?.[String(i.name).toLowerCase()]?.calories) || 0) * (Number(i.qty) || 1);
  const total = items.reduce((s, i) => s + kcalOf(i), 0);
  return (
    <Sheet
      title={editing ? "Edit saved meal" : "New saved meal"}
      onClose={onClose}
      tall
      footer={
        <>
          <div style={{ flex: 1, fontSize: 14 }}>
            <span style={{ fontWeight: 600 }}>{items.length} {items.length === 1 ? "food" : "foods"}</span>
            <span style={{ color: "var(--text-muted)" }}> · {r(total)} kcal</span>
          </div>
          <button onClick={onSave} disabled={!name || !items.length} style={{ ...primaryBtn, opacity: name && items.length ? 1 : 0.5 }}>Save meal</button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={sheetLabel}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Usual weekday lunch" style={sheetInput} />
        </label>
        <label style={{ ...sheetInput, display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)" }}>
          <Search size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Add a food" aria-label="Search foods to add" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 15 }} />
        </label>
        {query && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, borderRadius: 14, border: "1px solid var(--border)", maxHeight: 220, overflowY: "auto" }}>
            {suggestions.slice(0, 20).map((name) => (
              <li key={name}>
                <button onClick={() => onAdd(name)} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 14px", border: "none", borderBottom: "1px solid var(--border)", background: "none", color: "var(--text)", fontFamily: "inherit", fontSize: 14, textAlign: "left", cursor: "pointer" }}>
                  <span style={{ textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>Add</span>
                </button>
              </li>
            ))}
            {suggestions.length === 0 && <li style={{ padding: "12px 14px", fontSize: 14, color: "var(--text-muted)" }}>No matching foods</li>}
          </ul>
        )}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.length === 0 && <li style={{ padding: "18px 0", fontSize: 14, color: "var(--text-muted)" }}>Search above to add foods to this meal.</li>}
          {items.map((i, idx) => (
            <li key={`${i.name}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>{r(kcalOf(i))} kcal</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", borderRadius: 10, background: "var(--accent-soft)" }}>
                <button onClick={() => onQty(idx, Math.max(0.5, i.qty > 1 ? i.qty - 1 : 0.5))} aria-label={`Less ${i.name}`} style={{ width: 32, height: 34, border: "none", background: "none", color: "var(--accent-text)", fontFamily: "inherit", fontSize: 18, cursor: "pointer" }}>−</button>
                <span style={{ minWidth: 18, textAlign: "center", fontWeight: 600, color: "var(--accent-text)" }}>{fmtQty(i.qty)}</span>
                <button onClick={() => onQty(idx, i.qty < 1 ? 1 : i.qty + 1)} aria-label={`More ${i.name}`} style={{ width: 32, height: 34, border: "none", background: "none", color: "var(--accent-text)", fontFamily: "inherit", fontSize: 18, cursor: "pointer" }}>+</button>
              </div>
              <button onClick={() => onRemove(idx)} aria-label={`Remove ${i.name}`} style={{ width: 32, height: 32, border: "none", background: "none", color: "var(--text-faint)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}


/** Snap a plate — confirm what the photo shows, fix it, then log. */
export function SnapSheet({ image, loading, items, error, correction, setCorrection, onQty, onRemove, onRedo, onConfirm, onClose, meal }) {
  const kcal = items.reduce((s, i) => s + (Number(i.calories) || 0), 0);
  return (
    <Sheet
      title={loading ? "Reading your photo…" : items.length ? "Here’s what I see" : "Snap a plate"}
      subtitle={loading ? null : items.length ? "Adjust anything that’s off, then log it" : "Describe your meal to add it"}
      onClose={onClose}
      footer={
        !loading && (
          <>
            <div style={{ flex: 1, fontSize: 14 }}>
              <span style={{ fontWeight: 600 }}>{items.length} {items.length === 1 ? "item" : "items"}</span>
              <span style={{ color: "var(--text-muted)" }}> · {r(kcal)} kcal</span>
            </div>
            <button onClick={onConfirm} disabled={!items.length} style={{ ...primaryBtn, opacity: items.length ? 1 : 0.5 }}>Log to {meal}</button>
          </>
        )
      }
    >
      {image?.dataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.dataUrl} alt="Your meal" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", display: "block", marginBottom: 8 }} />
      )}
      {loading ? (
        <div style={{ display: "grid", placeItems: "center", gap: 10, padding: "30px 0", color: "var(--text-muted)", fontSize: 14 }}>
          <span className="animate-spin" style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid var(--track)", borderTopColor: "var(--accent)" }} />
          Identifying foods…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((it, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>{r(it.calories)} kcal · P {r(it.protein)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", borderRadius: 10, background: "var(--accent-soft)" }}>
                  <button onClick={() => onQty(i, -1)} aria-label={`Less ${it.name}`} style={{ width: 32, height: 34, border: "none", background: "none", color: "var(--accent-text)", fontFamily: "inherit", fontSize: 18, cursor: "pointer" }}>−</button>
                  <span style={{ minWidth: 18, textAlign: "center", fontWeight: 600, color: "var(--accent-text)" }}>{+Number(it.qty).toFixed(2)}</span>
                  <button onClick={() => onQty(i, +1)} aria-label={`More ${it.name}`} style={{ width: 32, height: 34, border: "none", background: "none", color: "var(--accent-text)", fontFamily: "inherit", fontSize: 18, cursor: "pointer" }}>+</button>
                </div>
                <button onClick={() => onRemove(i)} aria-label={`Remove ${it.name}`} style={{ width: 30, height: 30, border: "none", background: "none", color: "var(--text-faint)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
          {error && (
            <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 12, background: "var(--warn-soft)", color: "var(--warn)", fontSize: 13, lineHeight: 1.5 }}>{error}</div>
          )}
          {!items.length && !error && <div style={{ padding: "16px 0", fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>No foods identified yet.</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onRedo()}
              placeholder="Fix it: “3 rotis, no salad”"
              aria-label="Correct the items"
              style={{ ...sheetInput, flex: 1, minWidth: 0, height: 46, fontSize: 14 }}
            />
            <button onClick={onRedo} disabled={!correction.trim()} style={{ height: 46, padding: "0 14px", borderRadius: 14, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 14, cursor: "pointer", opacity: correction.trim() ? 1 : 0.5 }}>
              Redo
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ── Account setup (after first email-code sign-in) ───────────────────── */

export function AccountSetupSheet({ username, setUsername, password, setPassword, onSave, onClose }) {
  return (
    <Sheet
      title="Finish setting up"
      subtitle="Optional · takes 20 seconds"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} style={{ ...dangerBtn, background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", fontWeight: 400 }}>Later</button>
          <button onClick={onSave} style={{ ...primaryBtn, flex: 1 }}>Save</button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={sheetLabel}>
          Username
          <input value={username || ""} onChange={(e) => setUsername(e.target.value)} placeholder="How friends see you on Social" autoComplete="username" style={sheetInput} />
        </label>
        <label style={sheetLabel}>
          Password
          <input type="password" value={password || ""} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" style={sheetInput} />
        </label>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-faint)", lineHeight: 1.5 }}>
          A password lets you sign in without waiting for an email code. You can change both any time in Me → Account.
        </p>
      </div>
    </Sheet>
  );
}

/* ── Deep-link prompts (push nudges / home-screen shortcuts) ──────────── */

// Browsers only open the camera after a real tap, so a nudge or shortcut
// lands here: one tap to open the camera, or pick from the gallery.
export function SnapPromptSheet({ meal, onPick, onClose }) {
  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onPick(f);
  };
  return (
    <Sheet title={`Snap your ${meal.toLowerCase()}`} subtitle="Takes about 10 seconds" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ ...primaryBtn, display: "flex", alignItems: "center", justifyContent: "center" }}>
          Open camera
          <input type="file" accept="image/*" capture="environment" onChange={pick} hidden />
        </label>
        <label style={{ ...primaryBtn, background: "transparent", color: "var(--text)", border: "1px solid var(--border)", fontWeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          Choose from gallery
          <input type="file" accept="image/*" onChange={pick} hidden />
        </label>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-faint)", textAlign: "center" }}>You’ll check the foods before anything is logged.</p>
      </div>
    </Sheet>
  );
}

// "Same as yesterday": shows exactly what will be logged, one tap to confirm.
// data: undefined = still loading · null = nothing logged at that meal.
export function RepeatMealSheet({ meal, data, onConfirm, onPickInstead, onClose }) {
  const items = data?.items || [];
  return (
    <Sheet
      title={`Yesterday’s ${meal.toLowerCase()}`}
      subtitle={data ? `${r(data.kcal)} kcal · ${items.length} item${items.length === 1 ? "" : "s"}` : undefined}
      onClose={onClose}
      footer={
        data === undefined ? null : items.length ? (
          <button onClick={() => onConfirm(items)} style={{ ...primaryBtn, flex: 1 }}>Log it to {meal}</button>
        ) : (
          <button onClick={onPickInstead} style={{ ...primaryBtn, flex: 1 }}>Add {meal.toLowerCase()} instead</button>
        )
      }
    >
      {data === undefined ? (
        <div style={{ padding: 20, textAlign: "center", fontSize: 14, color: "var(--text-muted)" }}>Loading yesterday…</div>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 15, color: "var(--text-muted)", lineHeight: 1.5 }}>Nothing was logged at {meal.toLowerCase()} yesterday.</p>
      ) : (
        <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)" }}>
          {items.map((it, i) => (
            <div key={it.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 15 }}>
              <span style={{ flex: 1, minWidth: 0, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.name}{it.qty !== 1 ? ` × ${it.qty}` : ""}
              </span>
              <span style={{ color: "var(--text-muted)" }}>{r(it.calories)}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

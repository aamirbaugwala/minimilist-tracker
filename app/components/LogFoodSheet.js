"use client";

/**
 * LogFoodSheet (Direction A) — pick foods, then add them all.
 *
 * Cart model (user's choice): tapping "+" puts a food in the picks and turns
 * the row into a − qty + stepper; nothing is saved until "Add N items". Closing
 * with picks asks before discarding (also on Android back).
 *
 *   Header  "Add to Lunch ▾" (meal picker) · close
 *   Search  local DB + custom foods; Open Food Facts results when no match
 *   Tabs    Recent · Saved meals · Suggested · Browse (categories)
 *   Rows    name · serving · kcal · P, an optional medical tag, + / stepper
 *   Footer  "3 items · 450 kcal"  [Add 3 items]
 *
 * Stacking: z 9000 — above the page and nav, below the reward layer (toasts)
 * and the modals that open from here (custom food / meal builder, 10000).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { X, Search, ChevronDown, Check, Loader2, Pencil, Trash2, Plus, Sparkles, ScanBarcode } from "lucide-react";
import { FOOD_CATEGORIES } from "../food-data";
import { MEALS } from "../lib/mealPeriod";
import { exclusionReason } from "../lib/dietFilter";
import { foodTag, activeConditionIds } from "../lib/foodTags";

// "dal fry (1 bowl)" → { title: "Dal fry", serving: "1 bowl" }
function splitName(name) {
  const s = String(name || "");
  const i = s.indexOf("(");
  const title = (i > 0 ? s.slice(0, i) : s).trim();
  const serving = i > 0 ? s.slice(i + 1).replace(/\)\s*$/, "").trim() : "";
  return { title: title.charAt(0).toUpperCase() + title.slice(1), serving };
}
const per = (item) => ({
  calories: Number(item?.calories) || 0,
  protein: Number(item?.protein) || 0,
  carbs: Number(item?.carbs) || 0,
  fats: Number(item?.fats) || 0,
  fiber: Number(item?.fiber) || 0,
});
const stepUp = (q) => (q < 1 ? 1 : q + 1);
const stepDown = (q) => (q > 1 ? q - 1 : q === 1 ? 0.5 : 0);
const fmtQty = (q) => (q === 0.5 ? "½" : String(q));

const btnReset = { border: "none", background: "none", fontFamily: "inherit", cursor: "pointer", padding: 0 };

function Stepper({ qty, onDec, onInc, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", borderRadius: 10, background: "var(--accent-soft)", flexShrink: 0 }}>
      <button onClick={onDec} aria-label={`Less ${label}`} style={{ ...btnReset, width: 34, height: 36, color: "var(--accent-text)", fontSize: 18 }}>−</button>
      <span aria-live="polite" style={{ minWidth: 18, textAlign: "center", fontSize: 14, fontWeight: 600, color: "var(--accent-text)" }}>{fmtQty(qty)}</span>
      <button onClick={onInc} aria-label={`More ${label}`} style={{ ...btnReset, width: 34, height: 36, color: "var(--accent-text)", fontSize: 18 }}>+</button>
    </div>
  );
}

function FoodRow({ name, item, qty, tag, onAdd, onDec, onInc, sub }) {
  const { title, serving } = splitName(name);
  const p = per(item);
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
            {sub || [serving, `${Math.round(p.calories)} kcal`, `P ${Math.round(p.protein)}`].filter(Boolean).join(" · ")}
          </span>
          {tag && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 99,
                background: tag.kind === "watch" ? "var(--warn-soft)" : "var(--accent-soft)",
                color: tag.kind === "watch" ? "var(--warn)" : "var(--accent-text)",
              }}
            >
              {tag.text}
            </span>
          )}
        </div>
      </div>
      {qty > 0 ? (
        <Stepper qty={qty} onDec={onDec} onInc={onInc} label={title} />
      ) : (
        <button
          onClick={onAdd}
          aria-label={`Pick ${title}`}
          style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", display: "grid", placeItems: "center", cursor: "pointer" }}
        >
          <Plus size={16} />
        </button>
      )}
    </li>
  );
}

export default function LogFoodSheet({
  onClose,
  onCommit, // (entries[]) => void   entries: { name, qty, per, isWeb, meal }
  autoFocusSearch,
  selectedMeal,
  setSelectedMeal,
  query,
  setQuery,
  foodDb,
  recents,
  savedMeals,
  suggestions,
  webResults,
  isWebSearching,
  userProfile,
  conditions,
  openMealBuilder,
  deleteMeal,
  onCustomFood,
  onScan,
}) {
  const panelRef = useRef(null);
  const [cart, setCart] = useState(() => new Map()); // "Meal|food" → { name, qty, per, isWeb, meal }
  // null = not chosen yet → derived each render (Recent once recents exist, else
  // Browse). Deciding once at mount picked Browse when the sheet was opened
  // before recents had loaded, and it never switched back.
  const [chosenTab, setTab] = useState(null);
  const [category, setCategory] = useState(Object.keys(FOOD_CATEGORIES)[0]);
  const [mealOpen, setMealOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  const active = useMemo(() => activeConditionIds(conditions), [conditions]);
  const rules = useMemo(
    () => ({ dietaryPattern: userProfile?.dietary_pattern, allergies: userProfile?.allergies || [] }),
    [userProfile],
  );
  const tagFor = useCallback((name, item) => foodTag(name, per(item), active), [active]);

  // ── cart helpers
  // The cart is keyed by meal + food: switching the meal picker mid-way keeps
  // what was already picked under its own meal (2 for Breakfast, 2 for Lunch),
  // and the same food can be picked for two meals.
  const keyOf = (name) => String(name).toLowerCase();
  const cartKey = (name, meal = selectedMeal) => `${meal}|${keyOf(name)}`;
  const qtyOf = (name) => cart.get(cartKey(name))?.qty || 0;
  const setQty = (name, item, qty, isWeb = false) =>
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(cartKey(name));
      else next.set(cartKey(name), { name, qty, per: per(item), isWeb, meal: selectedMeal });
      return next;
    });
  const addMany = (items) =>
    setCart((prev) => {
      const next = new Map(prev);
      items.forEach(({ name, qty = 1 }) => {
        const item = foodDb[keyOf(name)];
        if (!item) return;
        const cur = next.get(cartKey(name));
        next.set(cartKey(name), { name, qty: (cur?.qty || 0) + (Number(qty) || 1), per: per(item), isWeb: false, meal: selectedMeal });
      });
      return next;
    });
  const totals = useMemo(() => {
    let kcal = 0;
    const byMeal = {};
    cart.forEach((e) => {
      kcal += e.per.calories * e.qty;
      byMeal[e.meal] = (byMeal[e.meal] || 0) + 1;
    });
    // In meal order, e.g. "Breakfast 2 · Lunch 2"
    const meals = MEALS.map((m) => m.label).filter((m) => byMeal[m]).map((m) => `${m} ${byMeal[m]}`);
    return { count: cart.size, kcal: Math.round(kcal), meals };
  }, [cart]);

  // ── open/close: history entry so Android back closes (or asks), body lock
  const onCloseRef = useRef(onClose);
  const cartSizeRef = useRef(0);
  const forceCloseRef = useRef(false);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    cartSizeRef.current = cart.size;
  }, [cart]);

  useEffect(() => {
    if (!window.history.state?.ntSheet) window.history.pushState({ ntSheet: true }, "");
    const onPop = () => {
      if (!forceCloseRef.current && cartSizeRef.current > 0) {
        window.history.pushState({ ntSheet: true }, ""); // stay open, ask first
        setConfirmDiscard(true);
        return;
      }
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const closeNow = useCallback(() => {
    forceCloseRef.current = true;
    if (window.history.state?.ntSheet) window.history.back(); // → popstate → onClose
    else onCloseRef.current();
  }, []);
  const requestClose = useCallback(() => {
    if (cartSizeRef.current > 0) setConfirmDiscard(true);
    else closeNow();
  }, [closeNow]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [requestClose]);

  // Focus synchronously after the opening tap so iOS raises the keyboard.
  useLayoutEffect(() => {
    if (autoFocusSearch) panelRef.current?.querySelector("input[type=search]")?.focus();
  }, [autoFocusSearch]);

  const commit = () => {
    if (!cart.size) return;
    onCommit([...cart.values()]); // each entry carries its own meal
    closeNow();
  };

  // ── lists
  const q = (query || "").trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    // Rank by the food's name without its serving ("paneer (100g)" → "paneer"):
    // exact name first, then names that start with the query, then shorter.
    const base = (k) => k.split("(")[0].trim();
    const rank = (k) => (base(k) === q ? 0 : base(k).startsWith(q) ? 1 : 2);
    return Object.keys(foodDb)
      .filter((k) => k.includes(q))
      .sort((a, b) => rank(a) - rank(b) || base(a).length - base(b).length || a.length - b.length)
      .slice(0, 40);
  }, [q, foodDb]);

  const recentRows = (recents || []).filter((n) => n && n !== "Water" && foodDb[keyOf(n)]);
  const tab = chosenTab ?? (recentRows.length ? "recent" : "browse");
  const categoryRows = Object.keys(FOOD_CATEGORIES[category] || {}).filter((k) => foodDb[k]);
  const suggestionRows = (suggestions || []).filter(
    (s) => s.items?.length && s.items.every((i) => !exclusionReason(i.name, rules)),
  );

  const rowFor = (name) => {
    const item = foodDb[keyOf(name)];
    return (
      <FoodRow
        key={name}
        name={name}
        item={item}
        qty={qtyOf(name)}
        tag={tagFor(name, item)}
        onAdd={() => setQty(name, item, 1)}
        onInc={() => setQty(name, item, stepUp(qtyOf(name)))}
        onDec={() => setQty(name, item, stepDown(qtyOf(name)))}
      />
    );
  };

  const tabs = [
    { id: "recent", label: "Recent" },
    { id: "saved", label: "Saved meals" },
    { id: "suggested", label: "Suggested" },
    { id: "browse", label: "Browse" },
  ];

  const emptyNote = (text) => <li style={{ padding: "18px 0", fontSize: 14, color: "var(--text-muted)" }}>{text}</li>;

  return (
    <div className="modal-overlay" style={{ zIndex: 9000, padding: 0, background: "var(--scrim)" }} onClick={(e) => e.target === e.currentTarget && requestClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Add food to ${selectedMeal}`}
        style={{
          width: "100%",
          maxWidth: 600,
          height: "92dvh",
          display: "flex",
          flexDirection: "column",
          background: "var(--sheet)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderBottom: "none",
          borderRadius: "22px 22px 0 0",
          animation: "sheetUp 0.28s cubic-bezier(0.32,0.72,0,1)",
          overflow: "hidden",
        }}
      >
        <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 99, background: "var(--track)", margin: "10px auto 0", flexShrink: 0 }} />

        {/* Header: meal picker + close */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 4px", flexShrink: 0, position: "relative" }}>
          <button onClick={() => setMealOpen((o) => !o)} aria-expanded={mealOpen} style={{ ...btnReset, display: "flex", alignItems: "center", gap: 6, color: "var(--text)", fontSize: 20, fontWeight: 600 }}>
            Add to {selectedMeal}
            <ChevronDown size={18} style={{ transform: mealOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>
          <button onClick={requestClose} aria-label="Close" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <X size={18} />
          </button>
          {mealOpen && (
            <div role="menu" style={{ position: "absolute", top: "100%", left: 16, zIndex: 2, minWidth: 180, padding: 6, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 18px 40px -16px rgba(0,0,0,.6)" }}>
              {MEALS.map((m) => (
                <button
                  key={m.label}
                  role="menuitemradio"
                  aria-checked={selectedMeal === m.label}
                  onClick={() => {
                    setSelectedMeal(m.label);
                    setMealOpen(false);
                  }}
                  style={{ ...btnReset, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, color: "var(--text)", fontSize: 15, background: selectedMeal === m.label ? "var(--accent-soft)" : "none" }}
                >
                  {m.label}
                  {selectedMeal === m.label && <Check size={16} color="var(--accent-text)" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: "10px 20px 0", flexShrink: 0 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, height: 48, padding: "0 14px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            <Search size={18} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods"
              aria-label="Search foods"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 15 }}
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" style={{ ...btnReset, color: "var(--text-faint)", display: "grid", placeItems: "center", width: 28, height: 28 }}>
                <X size={16} />
              </button>
            )}
            {onScan && !query && (
              <button onClick={onScan} aria-label="Scan a barcode" title="Scan a barcode" style={{ ...btnReset, color: "var(--accent-text)", display: "grid", placeItems: "center", width: 36, height: 36, marginRight: -6 }}>
                <ScanBarcode size={20} />
              </button>
            )}
          </label>
        </div>

        {/* Tabs (hidden while searching) */}
        {!q && (
          <div role="tablist" style={{ display: "flex", gap: 20, padding: "14px 20px 0", borderBottom: "1px solid var(--border)", flexShrink: 0, overflowX: "auto", scrollbarWidth: "none" }} className="chip-scroll">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                style={{ ...btnReset, padding: "0 0 10px", whiteSpace: "nowrap", fontSize: 14, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? "var(--text)" : "var(--text-muted)", borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}` }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "4px 20px 24px" }}>
          {active.size > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 0 2px" }}>
              Tags use your health profile ·{" "}
              <button onClick={() => setShowWhy((v) => !v)} style={{ ...btnReset, color: "var(--accent-text)", fontWeight: 600, fontSize: 12 }}>
                {showWhy ? "hide" : "why?"}
              </button>
              {showWhy && (
                <div style={{ marginTop: 6, lineHeight: 1.5 }}>
                  Based on your blood reports and the conditions in your profile, using each food’s calories, macros and type.
                  They’re gentle nudges, not medical advice.
                </div>
              )}
            </div>
          )}

          {q ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {searchResults.map(rowFor)}
              {searchResults.length === 0 && isWebSearching && (
                <li style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 0", color: "var(--text-muted)", fontSize: 14 }}>
                  <Loader2 size={16} className="animate-spin" /> Searching packaged foods…
                </li>
              )}
              {searchResults.length === 0 && !isWebSearching &&
                (webResults || []).map((w) => (
                  <FoodRow
                    key={`web-${w.name}`}
                    name={w.name}
                    item={w}
                    qty={qtyOf(w.name)}
                    sub={`${Math.round(w.calories || 0)} kcal · P ${Math.round(w.protein || 0)} · Open Food Facts`}
                    onAdd={() => setQty(w.name, w, 1, true)}
                    onInc={() => setQty(w.name, w, stepUp(qtyOf(w.name)), true)}
                    onDec={() => setQty(w.name, w, stepDown(qtyOf(w.name)), true)}
                  />
                ))}
              <li style={{ padding: "14px 0", fontSize: 14, color: "var(--text-muted)" }}>
                {searchResults.length ? "Not what you meant? " : "Can’t find it? "}
                <button onClick={() => onCustomFood(query)} style={{ ...btnReset, color: "var(--accent-text)", fontWeight: 600, fontSize: 14 }}>
                  Create “{query.trim()}”
                </button>
              </li>
            </ul>
          ) : tab === "recent" ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {recentRows.length ? recentRows.map(rowFor) : emptyNote("Foods you log will show up here.")}
            </ul>
          ) : tab === "saved" ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              <li style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                <button onClick={() => openMealBuilder()} style={{ ...btnReset, color: "var(--accent-text)", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <Plus size={16} /> New saved meal
                </button>
              </li>
              {(savedMeals || []).length === 0 && emptyNote("Save meals you eat often to add them in one tap.")}
              {(savedMeals || []).map((m) => {
                const kcal = (m.items || []).reduce((s, i) => s + (per(foodDb[keyOf(i.name)]).calories * (Number(i.qty) || 1)), 0);
                return (
                  <li key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3 }}>
                        {(m.items || []).length} items · {Math.round(kcal)} kcal
                      </div>
                    </div>
                    <button onClick={() => openMealBuilder(m)} aria-label={`Edit ${m.name}`} style={{ ...btnReset, width: 32, height: 32, color: "var(--text-faint)", display: "grid", placeItems: "center" }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteMeal(m.id)} aria-label={`Delete ${m.name}`} style={{ ...btnReset, width: 32, height: 32, color: "var(--text-faint)", display: "grid", placeItems: "center" }}>
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => addMany(m.items || [])} style={{ height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                      Pick all
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : tab === "suggested" ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              <li style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 0 2px" }}>Fits what’s left of today’s calories and protein</li>
              {suggestionRows.length === 0 && emptyNote("Nothing to suggest right now.")}
              {suggestionRows.map((s) => {
                const kcal = s.items.reduce((sum, i) => sum + per(foodDb[keyOf(i.name)]).calories * (Number(i.qty) || 1), 0);
                const prot = s.items.reduce((sum, i) => sum + per(foodDb[keyOf(i.name)]).protein * (Number(i.qty) || 1), 0);
                const single = s.items.length === 1 ? foodDb[keyOf(s.items[0].name)] : null;
                // How many whole combos are in the cart (each "+" adds the full set).
                const combos = Math.floor(Math.min(...s.items.map((i) => qtyOf(i.name) / (Number(i.qty) || 1))) + 1e-9);
                return (
                  <FoodRow
                    key={s.id || s.name}
                    name={s.items.map((i) => splitName(i.name).title).join(" + ")}
                    item={single || {}}
                    qty={s.items.length === 1 ? qtyOf(s.items[0].name) : combos}
                    tag={single ? tagFor(s.items[0].name, single) : null}
                    sub={`${Math.round(kcal)} kcal · P ${Math.round(prot)}`}
                    onAdd={() => addMany(s.items)}
                    onInc={() => addMany(s.items)}
                    onDec={() =>
                      single
                        ? setQty(s.items[0].name, single, stepDown(qtyOf(s.items[0].name)))
                        : // "−" takes off one whole combo, mirroring "+" — never leaves half servings behind.
                          s.items.forEach((i) => setQty(i.name, foodDb[keyOf(i.name)], Math.max(0, qtyOf(i.name) - (Number(i.qty) || 1))))
                    }
                  />
                );
              })}
              <li style={{ padding: "14px 0" }}>
                <Link href="/agent" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-text)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                  <Sparkles size={15} /> Ask Coach to plan a meal
                </Link>
              </li>
            </ul>
          ) : (
            <>
              <div className="chip-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 0 4px", scrollbarWidth: "none" }}>
                {Object.keys(FOOD_CATEGORIES).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    aria-pressed={category === c}
                    style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 99, border: `1px solid ${category === c ? "var(--accent)" : "var(--border)"}`, background: category === c ? "var(--accent-soft)" : "transparent", color: category === c ? "var(--text)" : "var(--text-muted)", fontFamily: "inherit", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{categoryRows.map(rowFor)}</ul>
            </>
          )}
        </div>

        {/* Footer: picks + Add, or the discard question */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 20px calc(14px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid var(--border)", background: "var(--sheet)" }}>
          {confirmDiscard ? (
            <>
              <div style={{ flex: 1, fontSize: 14 }}>Discard {totals.count} picked {totals.count === 1 ? "item" : "items"}?</div>
              <button onClick={() => setConfirmDiscard(false)} style={{ height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>
                Keep picking
              </button>
              <button onClick={closeNow} style={{ height: 44, padding: "0 14px", borderRadius: 12, border: "none", background: "var(--danger-soft)", color: "var(--danger)", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Discard
              </button>
            </>
          ) : (
            <>
              <div style={{ flex: 1, fontSize: 14 }}>
                {totals.count ? (
                  <>
                    <span style={{ fontWeight: 600 }}>{totals.count} {totals.count === 1 ? "item" : "items"}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {totals.meals.length > 1 ? ` · ${totals.meals.join(" · ")}` : ""} · {totals.kcal} kcal
                    </span>
                  </>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>Pick foods to add</span>
                )}
              </div>
              <button
                onClick={commit}
                disabled={!totals.count}
                style={{ height: 48, padding: "0 22px", borderRadius: 14, border: "none", background: totals.count ? "var(--accent)" : "var(--surface-highlight)", color: totals.count ? "var(--on-accent)" : "var(--text-faint)", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: totals.count ? "pointer" : "default" }}
              >
                {totals.count ? `Add ${totals.count} ${totals.count === 1 ? "item" : "items"}` : "Add"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

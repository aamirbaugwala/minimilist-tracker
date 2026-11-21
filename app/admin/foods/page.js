"use client";

/**
 * Admin → Foods (docs/food-database-design.md).
 *   Setup    table status, load built-in foods, migrate custom foods (preview → apply)
 *   Foods    search and edit built-in foods: names, aliases, per-100 g values, portions
 *   Review   users' foods that look like a built-in: merge or keep
 *   Promote  users' foods worth adding to the built-in list (counts only)
 *   Gaps     logged names that match no food (counts only) → add as a food
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "../../supabase";
import PageHeader, { SegmentedTabs } from "../../components/PageHeader";
import Sheet, { sheetInput, sheetLabel, primaryBtn, secondaryBtn } from "../../components/Sheet";
import { defaultPortion, portionLabel, portionMacros } from "../../lib/foodModel";

const TABS = [
  { id: "setup", label: "Setup" },
  { id: "foods", label: "Foods" },
  { id: "review", label: "Review" },
  { id: "promote", label: "Promote" },
  { id: "gaps", label: "Gaps" },
];
const card = { borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: 16 };
const rowStyle = { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" };
const smallBtn = { height: 34, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 };

export default function AdminFoodsPage() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [tab, setTab] = useState("setup");
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/");
      else setToken(session.access_token);
    });
  }, [router]);

  const api = useCallback(
    async (method, params) => {
      const url = method === "GET" ? `/api/admin/foods?${new URLSearchParams(params)}` : "/api/admin/foods";
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
        body: method === "POST" ? JSON.stringify(params) : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) setDenied(true);
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      return body;
    },
    [token],
  );

  return (
    <div className="app-wrapper" style={{ maxWidth: 880 }}>
      <PageHeader back="/admin" title="Foods" subtitle="Built-in list, users' foods and gaps" />
      {denied ? (
        <p style={{ color: "var(--text-muted)" }}>Admins only.</p>
      ) : !token ? (
        <Loader2 className="animate-spin" />
      ) : (
        <>
          <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
          <div style={{ marginTop: 16, paddingBottom: 60 }}>
            {tab === "setup" && <SetupTab api={api} />}
            {tab === "foods" && <FoodsTab api={api} />}
            {tab === "review" && <ReviewTab api={api} />}
            {tab === "promote" && <PromoteTab api={api} />}
            {tab === "gaps" && <GapsTab api={api} />}
          </div>
        </>
      )}
    </div>
  );
}

function useLoad(api, params, deps = []) {
  const [state, setState] = useState({ loading: true });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    api("GET", params)
      .then((data) => setState({ loading: false, data }))
      .catch((e) => setState({ loading: false, error: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, ...deps]);
  useEffect(() => {
    reload();
  }, [reload]);
  return [state, reload];
}

const Status = ({ state }) =>
  state.loading ? <Loader2 size={18} className="animate-spin" /> : state.error ? <p role="alert" style={{ color: "var(--danger)", fontSize: 14 }}>{state.error}</p> : null;

// ── Setup ───────────────────────────────────────────────────────────────────
function SetupTab({ api }) {
  const [state, reload] = useLoad(api, { view: "status" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [plan, setPlan] = useState(null);
  const s = state.data;

  const run = async (label, fn) => {
    setBusy(label);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg(`⚠️ ${e.message}`);
    } finally {
      setBusy("");
      reload();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Status state={state} />
      {s && (
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, fontSize: 14 }}>
            <Stat label="Tables" value={s.tableReady ? "Ready" : "Not created"} warn={!s.tableReady} />
            <Stat label="Built-in foods" value={s.tableReady ? `${s.builtins} / ${s.seedCount} in seed` : `${s.seedCount} in seed (bundled)`} />
            <Stat label="Users' foods" value={s.tableReady ? `${s.userFoods} active · ${s.merged} merged` : "—"} />
            <Stat label="Old custom foods" value={s.customRows} />
            <Stat label="Logs linked to a food" value={s.tableReady ? `${s.linkedLogs} of ${s.logs}` : "—"} />
            <Stat label="Seed version" value={s.seedVersion || "—"} />
          </div>
        </div>
      )}
      {s && !s.tableReady && (
        <div style={{ ...card, borderColor: "var(--warn)" }}>
          <strong>Step 1.</strong> Run <code>docs/foods-schema.sql</code> in Supabase → SQL Editor, then reload this page. Until then the app uses the bundled food list.
        </div>
      )}
      {s?.tableReady && (
        <>
          <div style={card}>
            <div style={{ fontWeight: 600 }}>Step 2. Load built-in foods</div>
            <p style={{ margin: "6px 0 12px", fontSize: 14, color: "var(--text-muted)" }}>
              Copies the {s.seedCount} foods from the bundled seed into the table and links existing logs to them. Safe to run again: foods you have edited here are left alone.
            </p>
            <button disabled={!!busy} onClick={() => run("seed", async () => setMsg(JSON.stringify(await api("POST", { action: "seed" }))))} style={primaryBtn}>
              {busy === "seed" ? <Loader2 size={16} className="animate-spin" /> : s.builtins ? "Refresh built-in foods" : "Load built-in foods"}
            </button>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 600 }}>Step 3. Migrate custom foods</div>
            <p style={{ margin: "6px 0 12px", fontSize: 14, color: "var(--text-muted)" }}>
              Turns each user&apos;s old custom foods into private foods. Clear copies of a built-in (same name, calories within 15%) merge into it; other spellings of the same food become one food. Preview first.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={!!busy || !s.builtins} onClick={() => run("plan", async () => setPlan((await api("POST", { action: "migrate", apply: false })).plan))} style={secondaryBtn}>
                {busy === "plan" ? <Loader2 size={16} className="animate-spin" /> : "Preview"}
              </button>
              {plan && (
                <button disabled={!!busy} onClick={() => run("apply", async () => { setMsg(JSON.stringify(await api("POST", { action: "migrate", apply: true }))); setPlan(null); })} style={primaryBtn}>
                  {busy === "apply" ? <Loader2 size={16} className="animate-spin" /> : "Apply migration"}
                </button>
              )}
            </div>
            {plan && <PlanView plan={plan} />}
          </div>
        </>
      )}
      {msg && <pre style={{ ...card, whiteSpace: "pre-wrap", fontSize: 12, color: "var(--text-muted)" }}>{msg}</pre>}
    </div>
  );
}

const Stat = ({ label, value, warn }) => (
  <div>
    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
    <div style={{ fontWeight: 600, color: warn ? "var(--warn)" : "var(--text)" }}>{value}</div>
  </div>
);

function PlanView({ plan }) {
  const c = plan.counts;
  return (
    <div style={{ marginTop: 14, fontSize: 14 }}>
      <p style={{ margin: "0 0 10px" }}>
        {c.rows} custom food rows: <strong>{c.autoMerge}</strong> merge into a built-in · <strong>{c.clusters}</strong> groups of spellings combine ·{" "}
        <strong>{c.review}</strong> kept but flagged for review · <strong>{c.keep}</strong> kept · {c.already} already migrated.
      </p>
      <Details title={`Auto-merge (${c.autoMerge})`} items={plan.autoMerge.map((x) => `${x.name} → ${x.into}${x.rows > 1 ? ` (${x.rows} rows)` : ""}`)} />
      <Details title={`Combined spellings (${c.clusters})`} items={plan.clusters.map((x) => `${x.names.join(" · ")} → ${x.into}`)} />
      <Details title={`For review (${c.review})`} items={plan.review.map((x) => `${x.name} ≈ ${x.candidate}`)} />
    </div>
  );
}
const Details = ({ title, items }) => (
  <details style={{ marginTop: 6 }}>
    <summary style={{ cursor: "pointer", color: "var(--accent-text)" }}>{title}</summary>
    <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "var(--text-muted)", maxHeight: 240, overflowY: "auto" }}>
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  </details>
);

// ── Foods ───────────────────────────────────────────────────────────────────
function FoodsTab({ api }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [state, reload] = useLoad(api, { view: "foods", q: term }, [term]);
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const foods = state.data?.foods || [];
  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ ...sheetInput, flex: 1, display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)" }}>
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search built-in foods" aria-label="Search built-in foods" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 15 }} />
        </label>
        <button onClick={() => setEditing(blankFood())} style={{ ...secondaryBtn, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> New
        </button>
      </div>
      <Status state={state} />
      <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
        {foods.map((f) => {
          const dp = defaultPortion(f);
          return (
            <li key={f.id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15 }}>
                  {f.name} {f.verified && <Check size={13} color="var(--accent-text)" aria-label="Reviewed" />}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  {f.category || "—"} · {portionLabel(f, dp)} · {portionMacros(f, dp).calories} kcal · {Math.round(f.kcal)} kcal/100{f.basis}
                  {f.aliases?.length ? ` · aka ${f.aliases.slice(0, 3).join(", ")}` : ""}
                </div>
              </div>
              <button onClick={() => setEditing(f)} style={smallBtn}>Edit</button>
            </li>
          );
        })}
      </ul>
      {editing && (
        <FoodEditor
          food={editing}
          categories={state.data?.categories || []}
          onClose={() => setEditing(null)}
          onSave={async (food) => {
            await api("POST", { action: "save", food });
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

const blankFood = (prefill = {}) => ({ id: null, name: "", category: "", family: "", aliases: [], basis: "g", kcal: "", protein: "", carbs: "", fat: "", fiber: "", status: "active", portions: [{ label: "1 serving", amount: 100, is_default: true }], ...prefill });

function FoodEditor({ food: initial, categories, onClose, onSave }) {
  const [f, setF] = useState(() => ({ ...initial, aliasesText: (initial.aliases || []).join(", "), portions: (initial.portions || []).map((p) => ({ ...p })) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const setPortion = (i, patch) => set({ portions: f.portions.map((p, j) => (j === i ? { ...p, ...patch } : patch.is_default ? { ...p, is_default: false } : p)) });
  const est = 4 * (Number(f.protein) || 0) + 4 * (Number(f.carbs) || 0) + 9 * (Number(f.fat) || 0);
  const off = Number(f.kcal) > 20 && Math.abs(est - Number(f.kcal)) / Number(f.kcal) > 0.2;
  const num = (key, label) => (
    <label key={key} style={{ ...sheetLabel, fontSize: 11, textAlign: "center", gap: 4 }}>
      {label}
      <input inputMode="decimal" value={f[key]} onChange={(e) => set({ [key]: e.target.value })} style={{ ...sheetInput, height: 44, padding: 0, textAlign: "center", minWidth: 0 }} />
    </label>
  );
  const unit = f.basis === "ml" ? "ml" : "g";
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave({ ...f, aliases: f.aliasesText.split(",").map((a) => a.trim()).filter(Boolean) });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };
  const preview = useMemo(() => ({ ...f, kcal: Number(f.kcal) || 0, protein: Number(f.protein) || 0, carbs: Number(f.carbs) || 0, fat: Number(f.fat) || 0, fiber: Number(f.fiber) || 0 }), [f]);
  return (
    <Sheet title={initial.id ? `Edit ${initial.name}` : "New built-in food"} onClose={onClose} tall footer={<button onClick={save} disabled={saving} style={{ ...primaryBtn, flex: 1 }}>{saving ? <Loader2 size={16} className="animate-spin" /> : "Save (marks as reviewed)"}</button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={sheetLabel}>
          Name (no portion)
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} style={sheetInput} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={sheetLabel}>
            Category
            <input list="food-cats" value={f.category || ""} onChange={(e) => set({ category: e.target.value })} style={sheetInput} />
            <datalist id="food-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label style={sheetLabel}>
            Family (optional)
            <input value={f.family || ""} onChange={(e) => set({ family: e.target.value })} placeholder="e.g. Biryani" style={sheetInput} />
          </label>
        </div>
        <label style={sheetLabel}>
          Also known as (comma-separated)
          <input value={f.aliasesText} onChange={(e) => set({ aliasesText: e.target.value })} placeholder="dahi, yogurt" style={sheetInput} />
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
          Measured in
          {["g", "ml"].map((b) => (
            <button key={b} onClick={() => set({ basis: b })} aria-pressed={f.basis === b} style={{ ...smallBtn, background: f.basis === b ? "var(--accent-soft)" : "transparent" }}>
              {b === "g" ? "grams" : "ml"}
            </button>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>Per 100 {unit}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
            {num("kcal", "kcal")}
            {num("protein", "Protein")}
            {num("carbs", "Carbs")}
            {num("fat", "Fat")}
            {num("fiber", "Fibre")}
          </div>
          {off && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--warn)", display: "flex", gap: 6, alignItems: "center" }}>
              <AlertTriangle size={14} /> Calories from macros ≈ {Math.round(est)} kcal, far from {f.kcal}. Check the values (high-fibre veg can differ a little).
            </p>
          )}
        </div>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>Portions</div>
          {f.portions.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <input type="radio" name="default-portion" checked={!!p.is_default} onChange={() => setPortion(i, { is_default: true })} aria-label="Default portion" style={{ accentColor: "var(--accent)" }} />
              <input value={p.label} onChange={(e) => setPortion(i, { label: e.target.value })} placeholder="1 bowl" aria-label="Portion name" style={{ ...sheetInput, height: 40, flex: 2 }} />
              <input inputMode="decimal" value={p.amount} onChange={(e) => setPortion(i, { amount: e.target.value })} aria-label={`Weight in ${unit}`} style={{ ...sheetInput, height: 40, flex: 1 }} />
              <span style={{ fontSize: 12, color: "var(--text-faint)", width: 22 }}>{unit}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)", width: 62, textAlign: "right" }}>{portionMacros(preview, { amount: Number(p.amount) || 0 }).calories} kcal</span>
              <button onClick={() => set({ portions: f.portions.filter((_, j) => j !== i) })} aria-label="Remove portion" style={{ ...smallBtn, width: 34, padding: 0, display: "grid", placeItems: "center" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button onClick={() => set({ portions: [...f.portions, { label: "", amount: "", is_default: !f.portions.length }] })} style={{ ...smallBtn, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Add portion
          </button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <input type="checkbox" checked={f.status === "hidden"} onChange={(e) => set({ status: e.target.checked ? "hidden" : "active" })} style={{ accentColor: "var(--accent)" }} />
          Hide from search
        </label>
        {error && <p role="alert" style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}
      </div>
    </Sheet>
  );
}

// ── Review ──────────────────────────────────────────────────────────────────
function ReviewTab({ api }) {
  const [state, reload] = useLoad(api, { view: "review" });
  const [busy, setBusy] = useState(null);
  const act = async (id, body) => {
    setBusy(id);
    try {
      await api("POST", body);
      reload();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };
  const items = state.data?.items || [];
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--text-muted)" }}>Users&apos; foods that look like a built-in food. Merge points the user&apos;s food and its logs at the built-in; Keep leaves it as their own.</p>
      <Status state={state} />
      {!state.loading && !items.length && <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Nothing to review.</p>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((it) => (
          <li key={it.id} style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
              <div>
                {it.name} <span style={{ color: "var(--text-faint)" }}>({it.portion} · {it.kcal} kcal)</span>
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                ≈ {it.target.name} <span style={{ color: "var(--text-faint)" }}>({it.target.portion} · {it.target.kcal} kcal)</span>
              </div>
            </div>
            <button disabled={busy === it.id} onClick={() => act(it.id, { action: "merge", foodId: it.id, targetId: it.target.id })} style={smallBtn}>Merge</button>
            <button disabled={busy === it.id} onClick={() => act(it.id, { action: "keep", foodId: it.id })} style={smallBtn}>Keep</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Promote ─────────────────────────────────────────────────────────────────
function PromoteTab({ api }) {
  const [state, reload] = useLoad(api, { view: "promote" });
  const [busy, setBusy] = useState(null);
  const items = state.data?.items || [];
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--text-muted)" }}>Users&apos; own foods that no built-in food covers, most shared first. Promoting adds it to everyone&apos;s list (marked reviewed) and points every copy at it.</p>
      <Status state={state} />
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((it) => (
          <li key={it.foodId} style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
              {it.name}
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                {it.users} {it.users === 1 ? "user" : "users"} · {it.logs} logs
              </div>
            </div>
            <button
              disabled={busy === it.foodId}
              onClick={async () => {
                setBusy(it.foodId);
                try {
                  await api("POST", { action: "promote", foodId: it.foodId });
                  reload();
                } catch (e) {
                  alert(e.message);
                } finally {
                  setBusy(null);
                }
              }}
              style={smallBtn}
            >
              Promote
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Gaps ────────────────────────────────────────────────────────────────────
function GapsTab({ api }) {
  const [state] = useLoad(api, { view: "gaps" });
  const [editing, setEditing] = useState(null);
  const items = state.data?.items || [];
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--text-muted)" }}>Names logged at least twice that match no food (usually from photos, voice or Coach). Add the common ones as built-in foods.</p>
      <Status state={state} />
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((it) => (
          <li key={it.name} style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
              <span style={{ textTransform: "capitalize" }}>{it.name}</span>
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                {it.logs} logs · ≈ {it.per.calories} kcal · P {it.per.protein} per logged serving
              </div>
            </div>
            <button
              onClick={() =>
                setEditing(
                  blankFood({
                    name: it.name.charAt(0).toUpperCase() + it.name.slice(1).replace(/\s*\(.*\)\s*$/, ""),
                    // Unknown weight: starts as "1 serving = 100 g" — set the real weight before saving.
                    kcal: it.per.calories, protein: it.per.protein, carbs: it.per.carbs, fat: it.per.fats, fiber: it.per.fiber,
                    portions: [{ label: "1 serving", amount: 100, is_default: true }],
                  }),
                )
              }
              style={smallBtn}
            >
              Add as food
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <FoodEditor
          food={editing}
          categories={[]}
          onClose={() => setEditing(null)}
          onSave={async (food) => {
            await api("POST", { action: "save", food });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

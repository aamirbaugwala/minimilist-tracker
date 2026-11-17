"use client";

/**
 * Recipe Studio (Direction A) — opened from Coach's tools row.
 *   Create: say what you feel like, tick a few preferences, pick servings,
 *           get one recipe with per-serving macros; log a serving to the
 *           current meal (with Undo) or save it.
 *   Saved:  your library; the same card, with Delete instead of Save.
 * Logging writes the app's 4 am day (dayKey) and the current meal, so the
 * entry lands where Today expects it.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { supabase } from "../supabase";
import PageHeader, { SegmentedTabs } from "../components/PageHeader";
import { primaryBtn, secondaryBtn } from "../components/Sheet";
import { dayKey } from "../lib/day";
import { uuid } from "../lib/uuid";
import { insertFoodLogs } from "../lib/foodLogInsert";
import { defaultMeal } from "../lib/mealPeriod";

const TAG_LABEL = {
  "high-protein": "High protein",
  "low-carb": "Low carb",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  "dairy-free": "Dairy-free",
  "gluten-free": "Gluten-free",
  "high-fiber": "High fibre",
  "low-fat": "Low fat",
  bulking: "Bulking",
  cutting: "Cutting",
};
const PREFS = ["High protein", "Vegetarian", "Low carb", "Gluten-free", "Under 20 min"];
const EXAMPLES = [
  "Something with paneer for dinner, not too heavy",
  "High-protein dal with brown rice",
  "Quick egg bhurji with roti",
  "Post-workout oats with banana",
];
const r0 = (n) => Math.round(Number(n) || 0);
const newId = uuid;

function Stepper({ value, onChange, min = 1, max = 10, label }) {
  const btn = { width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", display: "grid", placeItems: "center", cursor: "pointer" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} style={{ ...btn, opacity: value <= min ? 0.4 : 1 }}>
        <Minus size={16} />
      </button>
      <span style={{ fontSize: 15, minWidth: 82, textAlign: "center" }}>
        {value} {label}{value === 1 ? "" : "s"}
      </span>
      <button type="button" aria-label={`More ${label}s`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} style={{ ...btn, opacity: value >= max ? 0.4 : 1 }}>
        <Plus size={16} />
      </button>
    </div>
  );
}

function RecipeView({ recipe, meal, logged, onLog, onUndo, onSave, saving, saved, onDelete }) {
  const [showSteps, setShowSteps] = useState(false);
  const [copied, setCopied] = useState(false);
  const ps = recipe.per_serving || {};
  const steps = recipe.steps || [];

  const copy = async () => {
    const text = [
      recipe.name,
      recipe.description,
      "",
      "Ingredients:",
      ...(recipe.ingredients || []).map((i) => `• ${i.qty}${i.unit ? ` ${i.unit}` : ""} ${i.name}`),
      "",
      "Steps:",
      ...steps.map((s, i) => `${i + 1}. ${s.replace(/^Step \d+:\s*/i, "")}`),
      "",
      `Per serving: ${r0(ps.calories)} kcal · protein ${r0(ps.protein)} g · carbs ${r0(ps.carbs)} g · fat ${r0(ps.fats)} g`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — nothing to do */
    }
  };

  return (
    <article style={{ padding: 20, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, lineHeight: 1.3 }}>{recipe.name}</h2>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
        {recipe.servings || 1} serving{(recipe.servings || 1) === 1 ? "" : "s"}
        {recipe.tags?.length ? ` · ${recipe.tags.map((t) => TAG_LABEL[t] || t).join(" · ")}` : ""}
      </div>
      {recipe.description && <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--text-muted)" }}>{recipe.description}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, marginTop: 16, padding: "12px 4px", borderRadius: 14, background: "var(--bg)", textAlign: "center" }}>
        {[
          [r0(ps.calories), "kcal", "var(--text)"],
          [`${r0(ps.protein)} g`, "protein", "var(--protein)"],
          [`${r0(ps.carbs)} g`, "carbs", "var(--carbs)"],
          [`${r0(ps.fats)} g`, "fat", "var(--fats)"],
        ].map(([v, l, c]) => (
          <div key={l}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{v}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              {l !== "kcal" && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />}
              {l}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", marginTop: 6 }}>per serving · estimated</div>

      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 18 }}>Ingredients</div>
      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {(recipe.ingredients || []).map((ing, i) => (
          <li key={i} style={{ fontSize: 14, lineHeight: 1.45, display: "flex", gap: 10 }}>
            <span style={{ color: "var(--text-muted)", minWidth: 64, flexShrink: 0 }}>{ing.qty}{ing.unit ? ` ${ing.unit}` : ""}</span>
            <span>{ing.name}</span>
          </li>
        ))}
      </ul>

      {steps.length > 0 && (
        <>
          <button
            aria-expanded={showSteps}
            onClick={() => setShowSteps((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, padding: "8px 0", background: "none", border: "none", color: "var(--accent-text)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}
          >
            {showSteps ? "Hide steps" : `Show ${steps.length} steps`}
            <ChevronDown size={16} style={{ transform: showSteps ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
          {showSteps && (
            <ol style={{ margin: "6px 0 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8, fontSize: 14, lineHeight: 1.55 }}>
              {steps.map((s, i) => (
                <li key={i}>{s.replace(/^Step \d+:\s*/i, "")}</li>
              ))}
            </ol>
          )}
        </>
      )}

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        {logged ? (
          <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14, background: "var(--accent-soft)", fontSize: 14 }}>
            <Check size={18} color="var(--accent-text)" strokeWidth={2.4} />
            <span style={{ flex: 1 }}>Logged 1 serving to {logged.meal} · {r0(ps.calories)} kcal</span>
            <button onClick={onUndo} style={{ background: "none", border: "none", padding: 4, color: "var(--accent-text)", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Undo</button>
          </div>
        ) : (
          <button onClick={onLog} style={{ ...primaryBtn, width: "100%" }}>Log 1 serving to {meal}</button>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          {onSave && !saved && (
            <button onClick={onSave} disabled={saving} style={{ ...secondaryBtn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Save"}
            </button>
          )}
          {saved && onSave && (
            <span style={{ ...secondaryBtn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--accent-text)", cursor: "default" }}>
              <Check size={16} /> Saved
            </span>
          )}
          <button onClick={copy} style={{ ...secondaryBtn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {copied ? <Check size={16} color="var(--accent-text)" /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
          </button>
          {onDelete && (
            <button onClick={onDelete} aria-label="Delete recipe" style={{ ...secondaryBtn, width: 50, padding: 0, display: "grid", placeItems: "center", color: "var(--danger)" }}>
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function RecipesPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [prompt, setPrompt] = useState("");
  const [prefs, setPrefs] = useState([]);
  const [servings, setServings] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [latestRecipe, setLatestRecipe] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [recipes, setRecipes] = useState([]);
  const [libLoading, setLibLoading] = useState(false);
  const [tab, setTab] = useState("generate");
  const [openId, setOpenId] = useState(null);
  const [logged, setLogged] = useState({}); // recipe key → { rowId, meal }
  const [meal] = useState(() => defaultMeal());

  const textareaRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/");
        return;
      }
      setSession(session);
      setPageLoading(false);
      fetchRecipes(session);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchRecipes = async (sess = session) => {
    if (!sess) return;
    setLibLoading(true);
    try {
      const res = await fetch(`/api/recipes/list?userId=${sess.user.id}`, {
        headers: { Authorization: `Bearer ${sess.access_token}` },
      });
      const data = await res.json();
      if (data.recipes) setRecipes(data.recipes);
    } catch {
      /* silent */
    }
    setLibLoading(false);
  };

  const generateRecipe = async (e) => {
    e?.preventDefault?.();
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setGenError("");
    setLatestRecipe(null);
    setIsSaved(false);
    const full = prefs.length ? `${prompt.trim()}. Preferences: ${prefs.join(", ").toLowerCase()}.` : prompt.trim();
    try {
      const res = await fetch("/api/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: full, servings, userId: session.user.id, accessToken: session.access_token }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setGenError(data.error || "Couldn’t create a recipe. Try rewording it.");
        return;
      }
      setLatestRecipe(data.recipe);
    } catch {
      setGenError("No connection. Check your internet and try again.");
    } finally {
      setGenerating(false);
    }
  };

  const saveGeneratedRecipe = async () => {
    if (!latestRecipe || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/recipes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe: latestRecipe, userId: session.user.id, accessToken: session.access_token }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setGenError(data.error || "Couldn’t save the recipe.");
        return;
      }
      setRecipes((prev) => [data.recipe, ...prev]);
      setIsSaved(true);
      // Carry a log made before saving over to the saved copy's key.
      setLogged((prev) => (prev.latest ? { ...prev, [data.recipe.id]: prev.latest } : prev));
      setLatestRecipe(data.recipe);
    } catch {
      setGenError("No connection while saving. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRecipe = async (id) => {
    if (!confirm("Delete this recipe from your saved list?")) return;
    const res = await fetch(`/api/recipes/list?id=${id}&userId=${session.user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      setOpenId(null);
    }
  };

  const logRecipe = async (recipe, key) => {
    const ps = recipe.per_serving || {};
    const row = {
      id: newId(),
      user_id: session.user.id,
      date: dayKey(),
      created_at: new Date().toISOString(),
      meal,
      source: "recipe",
      name: recipe.name,
      qty: 1,
      calories: r0(ps.calories),
      protein: r0(ps.protein),
      carbs: r0(ps.carbs),
      fats: r0(ps.fats),
      fiber: r0(ps.fiber),
    };
    setLogged((prev) => ({ ...prev, [key]: { rowId: row.id, meal } }));
    const error = await insertFoodLogs(supabase, row);
    if (error) {
      setLogged((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setGenError(`Couldn’t log it: ${error.message}`);
    }
  };

  const undoLog = async (key) => {
    const entry = logged[key];
    if (!entry) return;
    setLogged((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const { error } = await supabase.from("food_logs").delete().eq("id", entry.rowId).eq("user_id", session.user.id);
    if (error) {
      setLogged((prev) => ({ ...prev, [key]: entry }));
      setGenError(`Couldn’t undo: ${error.message}`);
    }
  };

  if (pageLoading) {
    return (
      <div style={{ height: "100dvh", display: "grid", placeItems: "center", background: "var(--bg)" }}>
        <Loader2 size={24} color="var(--text-muted)" className="animate-spin" />
      </div>
    );
  }

  const latestKey = isSaved && latestRecipe?.id ? latestRecipe.id : "latest";

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--text)", maxWidth: 640, margin: "0 auto", paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}>
      <PageHeader back="/agent" title="Recipe Studio" subtitle="Recipes with full macros">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "generate", label: "Create" },
            { id: "library", label: `Saved · ${recipes.length}` },
          ]}
        />
      </PageHeader>

      <div style={{ padding: "8px 20px 0", display: "flex", flexDirection: "column", gap: 20 }}>
        {tab === "generate" && (
          <>
            <form onSubmit={generateRecipe} style={{ padding: 20, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
              <label htmlFor="recipe-prompt" style={{ fontSize: 13, color: "var(--text-muted)" }}>What do you feel like?</label>
              <textarea
                id="recipe-prompt"
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generateRecipe(e);
                }}
                placeholder="Something with paneer for dinner, not too heavy"
                rows={3}
                style={{ width: "100%", boxSizing: "border-box", padding: 14, borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit", fontSize: 16, lineHeight: 1.5, resize: "none", outline: "none" }}
              />
              <div role="group" aria-label="Preferences" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PREFS.map((p) => {
                  const on = prefs.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPrefs((prev) => (on ? prev.filter((x) => x !== p) : [...prev, p]))}
                      style={{ padding: "7px 12px", borderRadius: 99, border: on ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--text)" : "var(--text-muted)", fontFamily: "inherit", fontSize: 14, fontWeight: on ? 600 : 400, cursor: "pointer" }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <Stepper value={servings} onChange={setServings} label="serving" />
                <button type="submit" disabled={!prompt.trim() || generating} style={{ ...primaryBtn, flex: 1, minWidth: 150, opacity: !prompt.trim() || generating ? 0.5 : 1, cursor: !prompt.trim() || generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {generating ? <><Loader2 size={18} className="animate-spin" /> Creating…</> : "Create recipe"}
                </button>
              </div>
            </form>

            {genError && (
              <div role="alert" style={{ padding: 12, borderRadius: 12, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 14 }}>
                {genError}
              </div>
            )}

            {!generating && !latestRecipe && !prompt && (
              <div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>Try one of these</div>
                <div style={{ display: "flex", flexDirection: "column", borderRadius: 16, border: "1px solid var(--border)" }}>
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={ex}
                      onClick={() => {
                        setPrompt(ex);
                        textareaRef.current?.focus();
                      }}
                      style={{ padding: "13px 16px", border: "none", borderTop: i ? "1px solid var(--border)" : "none", background: "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 14, textAlign: "left", cursor: "pointer" }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {generating && (
              <div style={{ padding: 32, textAlign: "center", fontSize: 14, color: "var(--text-muted)" }}>
                <Loader2 size={22} className="animate-spin" color="var(--accent-text)" style={{ margin: "0 auto 10px", display: "block" }} />
                Working out the recipe and its macros… about 10 seconds.
              </div>
            )}

            {latestRecipe && !generating && (
              <RecipeView
                recipe={latestRecipe}
                meal={meal}
                logged={logged[latestKey]}
                onLog={() => logRecipe(latestRecipe, latestKey)}
                onUndo={() => undoLog(latestKey)}
                onSave={saveGeneratedRecipe}
                saving={isSaving}
                saved={isSaved}
              />
            )}
          </>
        )}

        {tab === "library" &&
          (libLoading && recipes.length === 0 ? (
            <div style={{ padding: 32, display: "grid", placeItems: "center" }}>
              <Loader2 size={20} className="animate-spin" color="var(--text-muted)" />
            </div>
          ) : recipes.length === 0 ? (
            <div style={{ padding: 24, borderRadius: 20, border: "1px dashed var(--border)", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>No saved recipes yet</div>
              <p style={{ margin: "8px 0 16px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>Create one and tap Save — it’ll be here to log again any day.</p>
              <button onClick={() => setTab("generate")} style={primaryBtn}>Create a recipe</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recipes.map((r) =>
                openId === r.id ? (
                  <div key={r.id}>
                    <button onClick={() => setOpenId(null)} style={{ background: "none", border: "none", padding: "4px 0 10px", color: "var(--text-muted)", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
                      Collapse
                    </button>
                    <RecipeView recipe={r} meal={meal} logged={logged[r.id]} onLog={() => logRecipe(r, r.id)} onUndo={() => undoLog(r.id)} onDelete={() => deleteRecipe(r.id)} />
                  </div>
                ) : (
                  <button
                    key={r.id}
                    onClick={() => setOpenId(r.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                        {r0(r.per_serving?.calories)} kcal · {r0(r.per_serving?.protein)} g protein per serving
                      </span>
                    </span>
                    {logged[r.id] ? <Check size={18} color="var(--accent-text)" /> : <ChevronDown size={18} color="var(--text-faint)" />}
                  </button>
                ),
              )}
            </div>
          ))}

        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--text-faint)" }}>
          Macros are estimated from the ingredients. Logged recipes show up on Today under {meal}.
        </p>
      </div>
    </div>
  );
}

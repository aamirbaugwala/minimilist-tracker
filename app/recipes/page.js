"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import {
  ArrowLeft,
  Sparkles,
  ChefHat,
  Loader2,
  Trash2,
  Plus,
  Minus,
  BookOpen,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Leaf,
  Copy,
  Check,
  UtensilsCrossed,
  Info,
} from "lucide-react";

// ─── TAG COLOURS ──────────────────────────────────────────────────────────────
const TAG_COLORS = {
  "high-protein":  { bg: "#3b82f620", color: "#3b82f6", label: "High Protein" },
  "low-carb":      { bg: "#f59e0b20", color: "#f59e0b", label: "Low Carb" },
  "vegetarian":    { bg: "#10b98120", color: "#10b981", label: "Vegetarian" },
  "vegan":         { bg: "#22c55e20", color: "#22c55e", label: "Vegan" },
  "dairy-free":    { bg: "#8b5cf620", color: "#8b5cf6", label: "Dairy-Free" },
  "gluten-free":   { bg: "#ec489920", color: "#ec4899", label: "Gluten-Free" },
  "high-fiber":    { bg: "#06b6d420", color: "#06b6d4", label: "High Fiber" },
  "low-fat":       { bg: "#f9731620", color: "#f97316", label: "Low Fat" },
  "bulking":       { bg: "#6366f120", color: "#6366f1", label: "Bulking" },
  "cutting":       { bg: "#ef444420", color: "#ef4444", label: "Cutting" },
};

// ─── MACRO PILL ───────────────────────────────────────────────────────────────
function MacroPill({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 4, padding: "8px 14px", borderRadius: 12,
      background: `${color}15`, border: `1px solid ${color}30`, flex: 1,
    }}>
      <Icon size={14} color={color} />
      <span style={{ fontSize: "0.75rem", color: "#71717a" }}>{label}</span>
      <span style={{ fontSize: "0.9rem", fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ─── RECIPE CARD ──────────────────────────────────────────────────────────────
function RecipeCard({ recipe, onDelete, onLog }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const ps = recipe.per_serving;

  const copyRecipe = () => {
    const text = [
      `📋 ${recipe.name}`,
      recipe.description,
      `\n🥗 Ingredients:`,
      ...(recipe.ingredients || []).map((i) => `• ${i.qty}${i.unit} ${i.name} — ${i.calories} kcal`),
      `\n👨‍🍳 Steps:`,
      ...(recipe.steps || []).map((s, i) => `${i + 1}. ${s}`),
      `\n📊 Per serving: ${ps?.calories} kcal | P: ${ps?.protein}g | C: ${ps?.carbs}g | F: ${ps?.fats}g`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16,
      border: "1px solid var(--border)", overflow: "hidden",
    }}>
      {/* Header */}
      <div
        style={{ padding: "16px 16px 12px", cursor: "pointer" }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>{recipe.name}</div>
            {recipe.description && (
              <div style={{ fontSize: "0.8rem", color: "#71717a", lineHeight: 1.5 }}>{recipe.description}</div>
            )}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#52525b", whiteSpace: "nowrap" }}>
            {expanded ? "▲ less" : "▼ full recipe"}
          </div>
        </div>

        {/* Tags */}
        {recipe.tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {recipe.tags.map((tag) => {
              const t = TAG_COLORS[tag] || { bg: "#27272a", color: "#a1a1aa", label: tag };
              return (
                <span key={tag} style={{
                  fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px",
                  borderRadius: 20, background: t.bg, color: t.color,
                  border: `1px solid ${t.color}30`,
                }}>{t.label}</span>
              );
            })}
          </div>
        )}

        {/* Macro summary always visible */}
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <MacroPill icon={Flame}   label="kcal"    value={ps?.calories} color="#f59e0b" />
          <MacroPill icon={Beef}    label="protein"  value={`${ps?.protein}g`} color="#3b82f6" />
          <MacroPill icon={Wheat}   label="carbs"    value={`${ps?.carbs}g`}   color="#10b981" />
          <MacroPill icon={Droplets} label="fats"   value={`${ps?.fats}g`}    color="#f97316" />
        </div>
      </div>

      {/* Expandable body */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px" }}>
          {/* Ingredients */}
          <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Leaf size={14} color="#10b981" /> Ingredients
            <span style={{ fontSize: "0.75rem", color: "#52525b", fontWeight: 400 }}>({recipe.servings} serving{recipe.servings > 1 ? "s" : ""})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
            {(recipe.ingredients || []).map((ing, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "0.8rem", padding: "5px 8px",
                borderRadius: 8, background: "var(--surface-highlight)",
              }}>
                <span>{ing.qty}{ing.unit} {ing.name}</span>
                <span style={{ color: "#71717a" }}>{ing.calories} kcal</span>
              </div>
            ))}
          </div>

          {/* Steps */}
          <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <UtensilsCrossed size={14} color="#6366f1" /> Steps
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {(recipe.steps || []).map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 10, fontSize: "0.8rem" }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", background: "#6366f120",
                  color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.7rem", fontWeight: 700, flexShrink: 0, marginTop: 1,
                }}>{i + 1}</div>
                <span style={{ color: "#d4d4d8", lineHeight: 1.5 }}>{step.replace(/^Step \d+:\s*/i, "")}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={copyRecipe}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 0", borderRadius: 10, border: "1px solid var(--border)",
                background: "transparent", color: "#a1a1aa", fontSize: "0.8rem", cursor: "pointer",
              }}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => onLog(recipe)}
              style={{
                flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 0", borderRadius: 10, border: "none",
                background: "#6366f1", color: "#fff", fontSize: "0.8rem",
                fontWeight: 600, cursor: "pointer",
              }}
            >
              <Plus size={14} />
              Log to Diary
            </button>
            <button
              onClick={() => onDelete(recipe.id)}
              style={{
                width: 38, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 10, border: "1px solid #ef444430",
                background: "#ef444410", color: "#ef4444", cursor: "pointer",
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function RecipesPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Generation state
  const [prompt, setPrompt] = useState("");
  const [servings, setServings] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [latestRecipe, setLatestRecipe] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Library state
  const [recipes, setRecipes] = useState([]);
  const [libLoading, setLibLoading] = useState(false);
  const [tab, setTab] = useState("generate"); // "generate" | "library"

  const textareaRef = useRef(null);

  // ── AUTH ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      setSession(session);
      setPageLoading(false);
      fetchRecipes(session);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── FETCH LIBRARY ─────────────────────────────────────────────────────────
  const fetchRecipes = async (sess = session) => {
    if (!sess) return;
    setLibLoading(true);
    try {
      const res = await fetch(`/api/recipes/list?userId=${sess.user.id}`, {
        headers: { Authorization: `Bearer ${sess.access_token}` },
      });
      const data = await res.json();
      if (data.recipes) setRecipes(data.recipes);
    } catch { /* silent */ }
    setLibLoading(false);
  };

  // ── GENERATE RECIPE ───────────────────────────────────────────────────────
  const generateRecipe = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setGenError("");
    setLatestRecipe(null);
    setIsSaved(false);

    try {
      const res = await fetch("/api/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          servings,
          userId: session.user.id,
          accessToken: session.access_token,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setGenError(data.error || "Failed to generate recipe.");
        return;
      }
      setLatestRecipe(data.recipe);
      setPrompt("");
    } catch {
      setGenError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  // ── SAVE GENERATED RECIPE TO LIBRARY ─────────────────────────────────────
  const saveGeneratedRecipe = async () => {
    if (!latestRecipe || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/recipes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe: latestRecipe,
          userId: session.user.id,
          accessToken: session.access_token,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setGenError(data.error || "Could not save recipe.");
        return;
      }
      setRecipes((prev) => [data.recipe, ...prev]);
      setIsSaved(true);
      setLatestRecipe(data.recipe); // update with DB id for delete/log
    } catch {
      setGenError("Network error while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── DELETE RECIPE ─────────────────────────────────────────────────────────
  const deleteRecipe = async (id) => {
    if (!confirm("Delete this recipe?")) return;
    const res = await fetch(`/api/recipes/list?id=${id}&userId=${session.user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setRecipes((prev) => prev.filter((r) => r.id !== id));
  };

  // ── LOG RECIPE TO DIARY ───────────────────────────────────────────────────
  const logRecipe = async (recipe) => {
    const ps = recipe.per_serving;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("food_logs").insert({
      user_id: session.user.id,
      date: today,
      name: recipe.name,
      qty: 1,
      calories: ps.calories,
      protein: ps.protein,
      carbs: ps.carbs,
      fats: ps.fats,
      fiber: ps.fiber || 0,
    });
    if (error) alert("Could not log recipe: " + error.message);
    else alert(`✅ "${recipe.name}" logged to today's diary (${ps.calories} kcal)`);
  };

  if (pageLoading) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b" }}>
        <Loader2 size={28} color="#6366f1" className="animate-spin" />
      </div>
    );
  }

  // ── EXAMPLE PROMPTS ───────────────────────────────────────────────────────
  const EXAMPLES = [
    "High-protein dal tadka with brown rice",
    "Low-carb paneer tikka with mint chutney",
    "Post-workout oats with banana and peanut butter",
    "Quick egg bhurji with whole wheat roti",
    "Vegan chickpea curry with quinoa",
  ];

  return (
    <div style={{
      minHeight: "100dvh", background: "#09090b", color: "#fff",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex", flexDirection: "column",
      maxWidth: 600, margin: "0 auto",
    }}>
      {/* ── HEADER ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#09090bdd", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => router.push("/")}
          style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", padding: 4 }}
        >
          <ArrowLeft size={20} />
        </button>
        <ChefHat size={20} color="#6366f1" />
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>Recipe Studio</div>
          <div style={{ fontSize: "0.7rem", color: "#52525b" }}>AI-generated recipes with full macros</div>
        </div>
        {/* Tab switcher */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, background: "var(--surface)", padding: 4, borderRadius: 10 }}>
          {["generate", "library"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "5px 12px", borderRadius: 7, border: "none",
              background: tab === t ? "#6366f1" : "transparent",
              color: tab === t ? "#fff" : "#71717a",
              fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
              textTransform: "capitalize",
            }}>{t === "library" ? `📚 ${recipes.length}` : "✨ Generate"}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {tab === "generate" && (
          <>
            {/* ── GENERATE FORM ── */}
            <form onSubmit={generateRecipe} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{
                background: "var(--surface)", borderRadius: 16,
                border: "1px solid var(--border)", overflow: "hidden",
              }}>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe a recipe… e.g. 'High-protein dal with brown rice for muscle gain'"
                  rows={3}
                  style={{
                    width: "100%", padding: "14px 16px", background: "transparent",
                    border: "none", outline: "none", color: "#fff", fontSize: "0.9rem",
                    resize: "none", lineHeight: 1.6,
                  }}
                />
                <div style={{
                  padding: "10px 16px", display: "flex",
                  justifyContent: "space-between", alignItems: "center",
                  borderTop: "1px solid var(--border)",
                }}>
                  {/* Servings counter */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.8rem", color: "#71717a" }}>Servings:</span>
                    <button type="button" onClick={() => setServings(Math.max(1, servings - 1))}
                      style={{ background: "var(--surface-highlight)", border: "none", color: "#fff", borderRadius: 6, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Minus size={12} />
                    </button>
                    <span style={{ fontWeight: 700, minWidth: 16, textAlign: "center" }}>{servings}</span>
                    <button type="button" onClick={() => setServings(Math.min(10, servings + 1))}
                      style={{ background: "var(--surface-highlight)", border: "none", color: "#fff", borderRadius: 6, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={!prompt.trim() || generating}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 16px", borderRadius: 10, border: "none",
                      background: !prompt.trim() || generating ? "#27272a" : "#6366f1",
                      color: !prompt.trim() || generating ? "#52525b" : "#fff",
                      fontWeight: 600, fontSize: "0.85rem", cursor: !prompt.trim() || generating ? "not-allowed" : "pointer",
                    }}
                  >
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {generating ? "Generating…" : "Generate"}
                  </button>
                </div>
              </div>

              {genError && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: "#ef444415", color: "#ef4444", fontSize: "0.82rem", border: "1px solid #ef444430" }}>
                  {genError}
                </div>
              )}
            </form>

            {/* ── EXAMPLE CHIPS ── */}
            {!generating && !latestRecipe && (
              <div>
                <div style={{ fontSize: "0.75rem", color: "#52525b", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                  <Sparkles size={11} /> Try these
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => { setPrompt(ex); textareaRef.current?.focus(); }}
                      style={{
                        padding: "6px 12px", borderRadius: 20, border: "1px solid var(--border)",
                        background: "var(--surface)", color: "#a1a1aa", fontSize: "0.75rem", cursor: "pointer",
                      }}>{ex}</button>
                  ))}
                </div>
              </div>
            )}

            {/* ── LATEST RESULT ── */}
            {generating && (
              <div style={{ textAlign: "center", padding: 40, color: "#52525b" }}>
                <Loader2 size={32} color="#6366f1" className="animate-spin" style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: "0.85rem" }}>Crafting your recipe with accurate macros…</div>
              </div>
            )}

            {latestRecipe && !generating && (
              <div>
                {/* Status label */}
                <div style={{ fontSize: "0.75rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 5,
                  color: isSaved ? "#10b981" : "#f59e0b" }}>
                  {isSaved ? <Check size={12} /> : <Info size={12} />}
                  {isSaved ? "Saved to your library!" : "Review your recipe — save or discard it below."}
                </div>

                <RecipeCard recipe={latestRecipe} onDelete={isSaved ? deleteRecipe : null} onLog={logRecipe} />

                {/* Save / Discard actions — only shown before saving */}
                {!isSaved && (
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button
                      onClick={saveGeneratedRecipe}
                      disabled={isSaving}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "11px 0", borderRadius: 12, border: "none",
                        background: isSaving ? "#27272a" : "#6366f1",
                        color: isSaving ? "#52525b" : "#fff",
                        fontWeight: 700, fontSize: "0.9rem", cursor: isSaving ? "not-allowed" : "pointer",
                      }}
                    >
                      {isSaving ? <Loader2 size={15} className="animate-spin" /> : <BookOpen size={15} />}
                      {isSaving ? "Saving…" : "Save to Library"}
                    </button>
                    <button
                      onClick={() => { setLatestRecipe(null); setIsSaved(false); }}
                      disabled={isSaving}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "11px 0", borderRadius: 12, border: "1px solid #3f3f46",
                        background: "transparent", color: "#71717a",
                        fontWeight: 600, fontSize: "0.9rem", cursor: isSaving ? "not-allowed" : "pointer",
                      }}
                    >
                      ✕ Discard
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === "library" && (
          <>
            <div style={{ fontSize: "0.8rem", color: "#52525b", display: "flex", alignItems: "center", gap: 6 }}>
              <BookOpen size={13} />
              {recipes.length === 0
                ? "No recipes yet — generate your first one!"
                : `${recipes.length} recipe${recipes.length > 1 ? "s" : ""} saved`}
            </div>

            {libLoading && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Loader2 size={24} color="#6366f1" className="animate-spin" style={{ margin: "0 auto" }} />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recipes.map((r) => (
                <RecipeCard key={r.id} recipe={r} onDelete={deleteRecipe} onLog={logRecipe} />
              ))}
            </div>
          </>
        )}

        {/* ── INFO FOOTER ── */}
        <div style={{
          marginTop: "auto", padding: "12px 14px", borderRadius: 12,
          background: "#6366f110", border: "1px solid #6366f130",
          display: "flex", gap: 8, fontSize: "0.75rem", color: "#818cf8",
        }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          Macros are AI-estimated. Log a recipe to add it to your diary. Tap any card to see ingredients &amp; steps.
        </div>
      </div>
    </div>
  );
}

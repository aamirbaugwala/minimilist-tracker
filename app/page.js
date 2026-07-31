"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Minus,
  X,
  Loader2,
  Flame,
  Trash2,
  Save,
  Target,
  KeyRound,
  Settings,
  PlusCircle,
  Scale,
} from "lucide-react";
import { FOOD_CATEGORIES, FLATTENED_DB } from "./food-data";
import { supabase } from "./supabase";
import { calculateTargets } from "./lib/nutrition";
import {
  deriveConditions,
  conditionsFromProfile,
  mergeConditions,
} from "./lib/conditions";
import OnboardingModal from "./components/OnboardingModal";
import { useAuth } from "./hooks/useAuth";
import StatsBoard from "./components/StatsBoard";
import AuthScreen from "./components/AuthScreen";
import SettingsModal from "./components/SettingsModal";
import FoodLogger from "./components/FoodLogger";
import Timeline from "./components/Timeline";
import RewardLayer from "./components/RewardLayer";
import QuestsCard from "./components/QuestsCard";
import CaptureBar from "./components/CaptureBar";
import { defaultMeal } from "./lib/mealPeriod";
import {
  xpForLog,
  levelFromXp,
  didLevelUp,
  computeQuests,
  completedQuestIds,
} from "./lib/gamification";

// The user's LOCAL calendar day (YYYY-MM-DD). Using toISOString() gives the UTC
// day, so anyone east/west of UTC can log a meal that then vanishes from
// "today" once UTC rolls over. Write and read must use the same local key.
const localDateKey = (d = new Date()) => {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

export default function Home() {
  const router = useRouter();
  const {
    session,
    initializing,
    authLoading,
    sendOtp,
    verifyOtp,
    signInWithPassword,
    signInWithGoogle,
    updatePassword: authUpdatePassword,
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  // Surfaces a real save failure instead of swallowing it into the console.
  const [saveError, setSaveError] = useState("");

  // ── Phase 1/3: reward + game state ──────────────────────────────────────────
  const [floats, setFloats] = useState([]); // floating +kcal / +XP bursts
  const [toast, setToast] = useState(null); // { name } — auto-save + undo
  const [celebration, setCelebration] = useState(null); // quest / level-up
  const [totalXp, setTotalXp] = useState(0);
  const totalXpRef = useRef(0);
  const lastAddRef = useRef(null); // last batch, for Undo
  const pendingRef = useRef({}); // tempId -> Promise<realId> (insert reconcile)
  const floatSeq = useRef(0);
  const toastTimer = useRef(null);
  const questPrevRef = useRef(null); // completed quest ids, to detect new ones

  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
    water: 0,
  });
  const [recents, setRecents] = useState([]);

  // UI State
  const [savedMeals, setSavedMeals] = useState([]);
  const [streak, setStreak] = useState(0);

  // Modals
  const [isCreatingMeal, setIsCreatingMeal] = useState(false);
  const [isSettingGoal, setIsSettingGoal] = useState(false);
  const [settingsTab, setSettingsTab] = useState("profile");
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);

  // --- EDIT LOG STATE ---
  const [isEditingLog, setIsEditingLog] = useState(false);
  const [currentLogToEdit, setCurrentLogToEdit] = useState(null);
  const [editQty, setEditQty] = useState(1);

  // --- CUSTOM FOODS & MANUAL ENTRY STATE ---
  const [customFoods, setCustomFoods] = useState([]);
  // Derived from the user's blood work; empty when they have no reports.
  // Conditions from blood reports; merged with self-reported ones below.
  const [biomarkerConditions, setBiomarkerConditions] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualFood, setManualFood] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    fiber: "",
  });

  // --- NEW: WEIGHT TRACKING STATE ---
  const [weightInput, setWeightInput] = useState("");
  const [isLoggingWeight, setIsLoggingWeight] = useState(false);

  // Data
  const [userProfile, setUserProfile] = useState({
    weight: "",
    height: "",
    age: "",
    gender: "male",
    activity: "sedentary",
    goal: "lose",
    target_calories: "",
  });

  // Blood-report conditions + self-reported ones, merged. Recomputes when either
  // the reports load or the user edits their health profile, so targets stay live.
  const conditions = useMemo(
    () => mergeConditions(biomarkerConditions, conditionsFromProfile(userProfile)),
    [biomarkerConditions, userProfile],
  );

  const [newPassword, setNewPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mealBuilderItems, setMealBuilderItems] = useState([]);
  const [mealBuilderQuery, setMealBuilderQuery] = useState("");
  const [editingMealId, setEditingMealId] = useState(null);
  const [newMealName, setNewMealName] = useState("");

  // UI & Auth
  const [qty, setQty] = useState(1);
  const [query, setQuery] = useState("");
  // Which meal new logs are filed under (user's explicit choice); starts on the
  // sensible one for the current time.
  const [selectedMeal, setSelectedMeal] = useState(() => defaultMeal());
  const [activeCategory, setActiveCategory] = useState("Recent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [usePasswordLogin, setUsePasswordLogin] = useState(false);
  // authLoading comes from useAuth hook above

  // --- WEB SEARCH STATE ---
  const [webResults, setWebResults] = useState([]);
  const [isWebSearching, setIsWebSearching] = useState(false);

  // --- MERGE LOCAL DB WITH CUSTOM DB ---
  const COMBINED_DB = useMemo(() => {
    const combined = { ...FLATTENED_DB };
    customFoods.forEach((cf) => {
      combined[cf.name.toLowerCase()] = cf;
    });
    return combined;
  }, [customFoods]);

  // --- AI MEAL PLAN STATE ---
  const [aiMealPlan, setAiMealPlan] = useState(null); // { text, toolsUsed }
  const [aiMealPlanLoading, setAiMealPlanLoading] = useState(false);

  const fetchAiMealPlan = async () => {
    if (!session || aiMealPlanLoading) return;
    setAiMealPlan(null);
    setAiMealPlanLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            "Build me a meal plan for the rest of the day based on my macro gap. Be specific with Indian food options and serving sizes. For every food you mention that is not already in the internal database, call save_food_to_database with your best estimated macros.",
          userId: session.user.id,
          accessToken: session.access_token,
          skipHistory: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAiMealPlan({
          text: "⚠️ " + (data.error || "Could not generate plan. Try again."),
          toolsUsed: [],
        });
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      const toolsUsed = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "tool") {
              toolsUsed.push(event.name);
            } else if (event.type === "chunk") {
              accumulated += event.text;
              setAiMealPlan({ text: accumulated, toolsUsed: [...toolsUsed] });
            } else if (event.type === "done") {
              // Refresh custom foods so newly saved items appear as loggable chips
              supabase
                .from("custom_foods")
                .select("*")
                .eq("user_id", session.user.id)
                .then(({ data: freshCustom }) => {
                  if (freshCustom) setCustomFoods(freshCustom);
                });
            } else if (event.type === "error") {
              setAiMealPlan({
                text: "⚠️ " + (event.message || "Could not generate plan."),
                toolsUsed,
              });
            }
          } catch {
            /* skip malformed SSE line */
          }
        }
      }
    } catch {
      setAiMealPlan({
        text: "⚠️ Network error. Please try again.",
        toolsUsed: [],
      });
    } finally {
      setAiMealPlanLoading(false);
    }
  };

  // --- FEATURE 1: SMART RECOMMENDATIONS LOGIC (legacy, unused) ---
  const generateSmartMeals = () => {
    // Use centralised target calculation
    const t = calculateTargets(userProfile, conditions);
    const targetCals = t.cals;
    const targetP = t.p;
    const targetF = t.f;
    const targetC = t.c;

    // REAL Remaining values
    const remainingCals = targetCals - totals.calories;
    const remainingPro = Math.max(0, targetP - totals.protein);
    const remainingFat = Math.max(0, targetF - totals.fats);
    const remainingCarb = Math.max(0, targetC - totals.carbs);

    // Hard Stop if basically full
    if (remainingCals < 50) return [];

    const candidates = [];
    if (COMBINED_DB) {
      Object.entries(COMBINED_DB).forEach(([key, item]) => {
        // Must fit in remaining calories (with slight buffer)
        if (item.calories <= remainingCals * 1.1) {
          let score = 0;

          // SCORING ALGORITHM:
          // 1. Boost if it provides protein we need
          if (remainingPro > 5) {
            if (item.protein > 15)
              score += 20; // High protein
            else if (item.protein > 5) score += 5;
          }

          // 2. Penalize fat if we are out of budget
          if (remainingFat < 5) {
            if (item.fats > 10)
              score -= 100; // Kill high fat items
            else if (item.fats > 5) score -= 50;
          }

          // 3. Boost carbs if we have plenty of room
          if (remainingCarb > 20 && item.carbs > 15) score += 5;

          // 4. Boost volume/fiber
          if (item.fiber > 3) score += 5;

          // 5. Penalize pure junk (Low Macro Density)
          if (item.calories > 200 && item.protein < 5 && item.fiber < 2)
            score -= 10;

          // Only keep good candidates
          if (score > -20) {
            candidates.push({ name: key, ...item, score });
          }
        }
      });
    }

    // Sort by Best Fit
    candidates.sort((a, b) => b.score - a.score);

    const recommendations = [];

    // STRATEGY A: Top 6 Single Items (Best for small gaps)
    candidates.slice(0, 6).forEach((item) => {
      recommendations.push({
        id: `smart-single-${item.name}-${Math.random()}`,
        name: item.name,
        type: "meal",
        items: [{ name: item.name, qty: 1 }],
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
        isSmart: true,
      });
    });

    // STRATEGY B: Combos (Only if enough calorie budget > 350)
    if (remainingCals > 350) {
      const proteins = candidates.filter((c) => c.protein > 10);
      const carbs = candidates.filter((c) => c.carbs > 15);

      for (let i = 0; i < 5; i++) {
        const p = proteins[Math.floor(Math.random() * proteins.length)];
        const c = carbs[Math.floor(Math.random() * carbs.length)];

        if (p && c && p.name !== c.name) {
          const combinedCals = p.calories + c.calories;
          const combinedFat = p.fats + c.fats;

          // Strict check for combos
          if (
            combinedCals <= remainingCals * 1.1 &&
            (remainingFat > 5 || combinedFat < 10)
          ) {
            recommendations.push({
              id: `smart-combo-${i}-${Math.random()}`,
              name: `${p.name} & ${c.name}`,
              type: "meal",
              items: [
                { name: p.name, qty: 1 },
                { name: c.name, qty: 1 },
              ],
              calories: combinedCals,
              protein: p.protein + c.protein,
              carbs: p.carbs + c.carbs,
              fats: combinedFat,
              isSmart: true,
            });
          }
        }
      }
    }

    // Fallback if empty (e.g. only 60 cals left) -> Find smallest items
    if (recommendations.length === 0) {
      const smallSnacks = Object.entries(COMBINED_DB)
        .filter(([, val]) => val.calories <= remainingCals)
        .sort((a, b) => b[1].calories - a[1].calories) // Biggest possible filler
        .slice(0, 3);

      smallSnacks.forEach(([key, val]) => {
        recommendations.push({
          id: `smart-fallback-${key}`,
          name: key,
          type: "meal",
          items: [{ name: key, qty: 1 }],
          ...val,
          isSmart: true,
        });
      });
    }

    return recommendations;
  };

  const smartRecommendations = useMemo(
    () => generateSmartMeals(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [totals, userProfile, COMBINED_DB],
  );

  // --- ACTUAL WEB SEARCH (OpenFoodFacts) ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!query || query.length < 3) {
        setWebResults([]);
        return;
      }

      // Check COMBINED_DB instead of FLATTENED_DB
      const localKeys = Object.keys(COMBINED_DB).filter((k) =>
        k.includes(query.toLowerCase()),
      );

      if (localKeys.length === 0) {
        setIsWebSearching(true);
        try {
          const response = await fetch(
            `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=5`,
          );
          const data = await response.json();

          if (data.products && data.products.length > 0) {
            const mappedResults = data.products.map((p) => ({
              id: `web-${p._id}`,
              name: p.product_name || query,
              isWeb: true,
              calories: Math.round(p.nutriments?.["energy-kcal_100g"] || 0),
              protein: Math.round(p.nutriments?.proteins_100g || 0),
              carbs: Math.round(p.nutriments?.carbohydrates_100g || 0),
              fats: Math.round(p.nutriments?.fat_100g || 0),
              fiber: Math.round(p.nutriments?.fiber_100g || 0),
            }));
            setWebResults(mappedResults);
          } else {
            setWebResults([]);
          }
        } catch (error) {
          console.error("Web search failed", error);
          setWebResults([]);
        } finally {
          setIsWebSearching(false);
        }
      } else {
        setWebResults([]);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [query, COMBINED_DB]);

  // --- INIT ---
  const fetchData = async (isBackground = false) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    if (!isBackground) setLoading(true);
    const todayKey = localDateKey(); // must match handleLocalAdd's write key

    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("date", todayKey)
      .order("created_at", { ascending: false });
    if (!error) {
      const enrichedLogs = data.map((log) => {
        if (log.name === "Water") return { ...log, fiber: 0 };
        if (log.fiber && log.fiber > 0) return log;
        // Use COMBINED_DB
        let dbItem = COMBINED_DB[log.name.toLowerCase()];
        if (!dbItem) {
          const key = Object.keys(COMBINED_DB).find((k) =>
            k.includes(log.name.toLowerCase()),
          );
          if (key) dbItem = COMBINED_DB[key];
        }
        if (dbItem && dbItem.fiber) {
          return { ...log, fiber: Math.round(dbItem.fiber * log.qty) };
        }
        return { ...log, fiber: 0 };
      });
      setLogs(enrichedLogs);
    }

    const { data: history } = await supabase
      .from("food_logs")
      .select("name")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (history) {
      const uniqueRecents = [...new Set(history.map((h) => h.name))];
      setRecents(uniqueRecents);
    }

    if (!isBackground) setLoading(false);
  };

  const fetchUserData = async () => {
    const { data: meals } = await supabase.from("saved_meals").select("*");
    if (meals) setSavedMeals(meals);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        // maybeSingle(), not single(): OAuth users arrive with no user_profiles
        // row yet, and single() would reject and abort the custom_foods fetch.
        .maybeSingle();

      if (profile) {
        setUserProfile(profile);
        if (profile.username) setUsername(profile.username);
      } else {
        // No profile row yet — typical for a first Google sign-in, or if a user
        // dismissed the account-setup modal. Seed one from the provider's
        // metadata so social/leaderboard shows a real name instead of "User".
        const meta = session.user.user_metadata || {};
        const seededName =
          meta.full_name || meta.name || session.user.email?.split("@")[0] || "";

        const { data: created, error: seedError } = await supabase
          .from("user_profiles")
          .upsert(
            {
              user_id: session.user.id,
              username: seededName,
              updated_at: new Date(),
            },
            { onConflict: "user_id" },
          )
          .select()
          .maybeSingle();

        if (seedError) {
          // Non-fatal (e.g. a username collision): the user can still set one
          // in Settings, so just surface it and keep the UI populated.
          console.warn("Could not seed user profile:", seedError.message);
        }
        if (created) setUserProfile(created);
        if (seededName) setUsername(seededName);
      }

      // First run: no profile, or no weight yet → auto-open the goal setter.
      if (!profile || !profile.weight) setShowOnboarding(true);

      const { data: custom } = await supabase.from("custom_foods").select("*");
      if (custom) setCustomFoods(custom);

      // Lifetime XP for the level bar (Phase 3). Absent row → level 1.
      const { data: gam } = await supabase
        .from("user_gamification")
        .select("total_xp")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const xp = gam?.total_xp || 0;
      setTotalXp(xp);
      totalXpRef.current = xp;

      // Blood work drives target adjustments (see lib/conditions.js). Only the
      // columns needed to resolve markers — the analysis text is large and
      // irrelevant here. Failures are non-fatal: no reports simply means no
      // adjustments, and the app behaves exactly as it did before.
      const { data: medical } = await supabase
        .from("medical_reports")
        .select("flags, report_date, created_at")
        .eq("user_id", session.user.id);
      setBiomarkerConditions(deriveConditions(medical || []));
    }
  };

  const calculateStreak = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("food_logs")
      .select("date")
      .eq("user_id", session.user.id)
      .order("date", { ascending: false });
    if (!data || data.length === 0) {
      setStreak(0);
      return;
    }

    const uniqueDates = [...new Set(data.map((item) => item.date))];
    const today = localDateKey();
    const yesterday = localDateKey(new Date(Date.now() - 86400000));

    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
      setStreak(0);
      return;
    }
    let count = 1;
    let currentDate = new Date(uniqueDates[0]);
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i]);
      if (
        Math.ceil(Math.abs(currentDate - prevDate) / (1000 * 60 * 60 * 24)) ===
        1
      ) {
        count++;
        currentDate = prevDate;
      } else break;
    }
    setStreak(count);
  };

  // useAuth handles getSession + onAuthStateChange subscription internally.
  // React to session changes: fetch data when session arrives, clear when it goes.
  useEffect(() => {
    if (session) {
      fetchData();
      fetchUserData(); // opens onboarding automatically for incomplete profiles
      calculateStreak();
    } else {
      setLogs([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Send admins to the portal instead of the tracker — but only ONCE per browser
  // session. Redirecting on every mount would make the admin page's "Back to App"
  // button bounce straight back here, trapping them in a loop.
  //
  // is_admin() is the same security-definer function the RPCs use, so there's a
  // single source of truth for who counts as an admin. This redirect is
  // convenience only; the real gate is server-side in the RPCs and RLS.
  useEffect(() => {
    if (!session) return;
    try {
      if (sessionStorage.getItem("nt_admin_routed")) return;
    } catch {
      return; // storage blocked — skip the redirect rather than loop
    }
    supabase
      .rpc("is_admin")
      .then(({ data }) => {
        if (data !== true) return;
        try {
          sessionStorage.setItem("nt_admin_routed", "1");
        } catch {
          /* ignore */
        }
        router.push("/admin");
      })
      .catch(() => {
        /* function may not exist yet — never block the app */
      });
  }, [session, router]);

  // Persist the first-run goal setter: profile (incl. health fields) + a
  // goal_history snapshot so past days keep their original targets.
  const completeOnboarding = async (draft) => {
    if (!session) return;
    const payload = {
      user_id: session.user.id,
      weight: draft.weight ? Number(draft.weight) : null,
      height: draft.height ? Number(draft.height) : null,
      age: draft.age ? Number(draft.age) : null,
      gender: draft.gender,
      activity: draft.activity,
      goal: draft.goal,
      calorie_adjustment: Number(draft.calorie_adjustment ?? 0),
      protein_priority: draft.protein_priority || "balanced",
      health_conditions: draft.health_conditions || [],
      dietary_pattern: draft.dietary_pattern || null,
      allergies: draft.allergies || [],
      updated_at: new Date(),
    };
    const { error } = await supabase
      .from("user_profiles")
      .upsert(payload, { onConflict: "user_id" });
    if (error) {
      alert("Could not save your setup — please try again.");
      return;
    }
    await supabase.from("goal_history").insert({
      user_id: session.user.id,
      goal: draft.goal,
      activity: draft.activity,
      calorie_adjustment: Number(draft.calorie_adjustment ?? 0),
      protein_priority: draft.protein_priority || "balanced",
      effective_from: new Date().toISOString().slice(0, 10),
    });
    setUserProfile((prev) => ({ ...prev, ...payload }));
    setShowOnboarding(false);
  };

  const saveGoal = async () => {
    if (
      !userProfile.target_calories &&
      (!userProfile.weight || !userProfile.height)
    )
      return alert("Please fill info");
    const { error } = await supabase.from("user_profiles").upsert({
      user_id: session.user.id,
      ...userProfile,
      target_calories: userProfile.target_calories
        ? Number(userProfile.target_calories)
        : null,
      calorie_adjustment: Number(userProfile.calorie_adjustment ?? 0),
      protein_priority: userProfile.protein_priority || "balanced",
      updated_at: new Date(),
    });
    if (error) {
      alert("Error saving goal");
      return;
    }

    // Snapshot the goal so past days retain their original targets
    await supabase.from("goal_history").insert({
      user_id: session.user.id,
      goal: userProfile.goal,
      activity: userProfile.activity,
      calorie_adjustment: Number(userProfile.calorie_adjustment ?? 0),
      protein_priority: userProfile.protein_priority || "balanced",
      target_calories: userProfile.target_calories
        ? Number(userProfile.target_calories)
        : null,
      effective_from: new Date().toISOString().slice(0, 10),
    });

    alert("Profile updated!");
    setIsSettingGoal(false);
  };

  const handleUpdatePassword = async () => {
    let msg = "";
    if (newPassword) {
      const result = await authUpdatePassword(newPassword);
      if (!result.ok) return alert(result.error);
      msg += "Password updated. ";
    }
    if (username) {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: session.user.id,
            username: username,
            updated_at: new Date(),
          },
          { onConflict: "user_id" },
        );
      if (profileError) {
        console.error(profileError);
        return alert("Error saving username.");
      }
      setUserProfile((prev) => ({ ...prev, username }));
      msg += "Username saved.";
    }
    if (!newPassword && !username)
      return alert("Please enter a username or password.");
    alert(msg);
    setNewPassword("");
    setShowPasswordSetup(false);
  };

  // --- NEW: HANDLE LOG WEIGHT ---
  const handleLogWeight = async () => {
    if (!weightInput) return;
    setIsLoggingWeight(true);
    const today = new Date().toISOString().slice(0, 10);
    const numWeight = Number(weightInput);

    try {
      // 1. Upsert to weight_logs (for dashboard trends)
      await supabase.from("weight_logs").upsert(
        {
          user_id: session.user.id,
          date: today,
          weight: numWeight,
        },
        { onConflict: "user_id, date" },
      );

      // 2. Update main profile (updates targets immediately)
      await supabase
        .from("user_profiles")
        .update({ weight: numWeight })
        .eq("user_id", session.user.id);

      // 3. Update local state
      setUserProfile((prev) => ({ ...prev, weight: numWeight }));
      setWeightInput("");
    } catch (err) {
      console.error(err);
      alert("Failed to log weight");
    } finally {
      setIsLoggingWeight(false);
    }
  };

  const saveCustomFoodToDb = async (item) => {
    if (!session) return;
    const exists = customFoods.find(
      (cf) => cf.name.toLowerCase() === item.name.toLowerCase(),
    );
    if (exists) return;

    const newFood = {
      user_id: session.user.id,
      name: item.name,
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fats: Number(item.fats) || 0,
      fiber: Number(item.fiber) || 0,
    };

    const { data, error } = await supabase
      .from("custom_foods")
      .insert([newFood])
      .select();

    if (!error && data) {
      setCustomFoods((prev) => [...prev, data[0]]);
    }
  };

  const handleManualAddSubmit = (e) => {
    e.preventDefault();
    if (!manualFood.name || !manualFood.calories)
      return alert("Missing details!");

    const formattedFood = {
      ...manualFood,
      calories: Number(manualFood.calories),
      protein: Number(manualFood.protein) || 0,
      carbs: Number(manualFood.carbs) || 0,
      fats: Number(manualFood.fats) || 0,
      fiber: Number(manualFood.fiber) || 0,
    };

    saveCustomFoodToDb(formattedFood);
    addFood(formattedFood.name, qty, formattedFood);

    setManualFood({
      name: "",
      calories: "",
      protein: "",
      carbs: "",
      fats: "",
      fiber: "",
    });
    setIsManualEntryOpen(false);
    setQuery("");
  };

  // ── Per-row persistence ─────────────────────────────────────────────────────
  // Rows carry a real UUID from creation, so a delete/edit/undo just needs to
  // wait for any in-flight insert of that id to finish, then act on the same id.
  const resolveRowId = (id) =>
    Promise.resolve(pendingRef.current[id]).then(() => id, () => id);

  // Per-unit macros for a food (from the item, or looked up in COMBINED_DB).
  const perUnitMacros = (item) => {
    let base = {
      calories: item.calories || 0,
      protein: item.protein || 0,
      carbs: item.carbs || 0,
      fats: item.fats || 0,
      fiber: item.fiber || 0,
    };
    if (item.name !== "Water" && base.calories === 0 && !item.isWeb) {
      let db = COMBINED_DB[item.name.toLowerCase()];
      if (!db) {
        const key = Object.keys(COMBINED_DB).find((k) =>
          k.includes(item.name.toLowerCase()),
        );
        if (key) db = COMBINED_DB[key];
      }
      if (db) base = db;
    }
    return base;
  };

  // ── XP (Phase 3) — optimistic, atomic in the DB, with level-up celebration ──
  const awardXp = (delta) => {
    if (!delta || !session) return;
    const prev = totalXpRef.current;
    const next = Math.max(0, prev + delta);
    totalXpRef.current = next;
    setTotalXp(next);
    if (delta > 0 && didLevelUp(prev, delta)) {
      setCelebration({
        id: Date.now(),
        kind: "level",
        icon: "⬆️",
        title: `Level ${levelFromXp(next).level}!`,
      });
    }
    // Fire-and-forget. supabase.rpc() returns a *thenable*, not a Promise, so
    // .catch() doesn't exist and calling it THROWS — which used to abort the
    // caller (handleLocalAdd) before it inserted the food. Await it inside a
    // try/catch instead so a missing add_xp RPC can never break logging.
    (async () => {
      try {
        await supabase.rpc("add_xp", { amount: delta });
      } catch {
        /* XP is best-effort (e.g. gamification.sql not run) */
      }
    })();
  };

  // ── Reward burst + Undo toast (Phase 1) ─────────────────────────────────────
  const fireReward = (kcal, xp, label, idSet) => {
    const base = ++floatSeq.current;
    // Water and other 0-kcal logs shouldn't flash "+0" — show just the XP,
    // centered, in that case.
    const bursts = kcal > 0
      ? [
          { id: base + "a", text: `+${kcal}`, color: "#fff", dx: -34 },
          { id: base + "b", text: `+${xp} XP`, color: "#a78bfa", dx: 22 },
        ]
      : [{ id: base + "b", text: `+${xp} XP`, color: "#a78bfa", dx: -18 }];
    setFloats((f) => [...f, ...bursts]);
    lastAddRef.current = { idSet, xp, label };
    setToast({ name: label });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  };

  // Insert a fully-formed food_logs row (its id is a client UUID, so it IS the
  // DB id — no reconciliation needed). Returns the Postgres error, or null on
  // success. Retries once on a transient failure; the retry is idempotent
  // because a duplicate id → PK conflict (23505), which means the first attempt
  // actually landed, so we treat it as success. Falls back to inserting without
  // `meal` if that column hasn't been migrated yet (PGRST204).
  const insertFoodLog = async (row) => {
    const attempt = async () => {
      let { error } = await supabase.from("food_logs").insert(row);
      if (error && (error.code === "PGRST204" || /meal/i.test(error.message || ""))) {
        const withoutMeal = { ...row };
        delete withoutMeal.meal;
        ({ error } = await supabase.from("food_logs").insert(withoutMeal));
      }
      return error;
    };
    let error = await attempt();
    if (error) {
      await new Promise((r) => setTimeout(r, 600));
      error = await attempt();
      if (error && (error.code === "23505" || /duplicate|unique/i.test(error.message || ""))) {
        error = null; // the first attempt saved after all
      }
    }
    return error;
  };

  // ── Add (append-only) ───────────────────────────────────────────────────────
  // Each item becomes its own food_logs row with a real created_at, so meal-time
  // grouping is accurate and Undo just deletes the batch. No Save step.
  const handleLocalAdd = (itemsToAdd) => {
    if (!session) return;
    const createdAt = new Date().toISOString();
    const dateKey = localDateKey(); // local calendar day, not UTC
    setSaveError("");

    // File everything in this batch under the meal the user has selected.
    const meal = selectedMeal || defaultMeal(createdAt);
    const newId = () =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "id_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const rows = itemsToAdd.map((item) => {
      const quantity = Number(item.qty) || 1;
      const base = perUnitMacros(item);
      return {
        id: newId(), // real UUID — becomes the DB primary key directly
        name: item.name,
        qty: quantity,
        calories: Math.round(base.calories * quantity),
        protein: Math.round(base.protein * quantity),
        carbs: Math.round(base.carbs * quantity),
        fats: Math.round(base.fats * quantity),
        fiber: Math.round((base.fiber || 0) * quantity),
        meal,
        date: dateKey,
        created_at: createdAt,
        user_id: session.user.id,
      };
    });
    const idSet = new Set(rows.map((r) => r.id));

    // optimistic — newest first
    setLogs((prev) => [...rows.slice().reverse(), ...prev]);

    // Presentation side-effects are wrapped so a throw here can NEVER skip the
    // DB insert below (the original data-loss bug: awardXp threw before persist).
    try {
      const kcal = rows.reduce((s, r) => s + r.calories, 0);
      const xp = rows.reduce((s, r) => s + xpForLog(r), 0);
      const label = rows.length === 1 ? rows[0].name : `${rows.length} items`;
      fireReward(kcal, xp, label, idSet);
      awardXp(xp);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate(16); } catch { /* ignore */ }
      }
    } catch (rewardErr) {
      console.error("Reward side-effect failed (logging continues):", rewardErr);
    }

    // Persist each row. The id is already the final DB id, so there is nothing
    // to reconcile — on success we just clear the pending marker; on failure we
    // roll the row back and surface the reason. pendingRef lets a delete/undo
    // that fires before the insert finishes wait for it (same id throughout).
    rows.forEach((row) => {
      const p = insertFoodLog(row)
        .then((error) => {
          if (error) throw error;
          delete pendingRef.current[row.id];
        })
        .catch((err) => {
          const msg = err?.message || err?.error_description || String(err);
          console.error("Could not save food log:", err);
          setSaveError(`Couldn't save "${row.name}": ${msg}`);
          setLogs((prev) => prev.filter((l) => l.id !== row.id));
          delete pendingRef.current[row.id];
        });
      pendingRef.current[row.id] = p;
    });
  };

  const undoLastAdd = () => {
    const last = lastAddRef.current;
    if (!last) return;
    const ids = [...last.idSet]; // snapshot; may be temp or reconciled
    const idsSet = new Set(ids);
    setLogs((prev) => prev.filter((l) => !idsSet.has(l.id)));
    ids.forEach((id) => {
      resolveRowId(id)
        .then((realId) => supabase.from("food_logs").delete().eq("id", realId))
        .catch(() => {});
    });
    awardXp(-last.xp);
    lastAddRef.current = null;
    setToast(null);
  };

  const addFood = (foodName, overrideQty = null, explicitMacros = null) => {
    handleLocalAdd([{ name: foodName, qty: overrideQty || qty, ...explicitMacros }]);
    if (!overrideQty && foodName !== "Water") {
      setQty(1);
      setQuery("");
    }
  };
  const loadMeal = (meal) => {
    handleLocalAdd(meal.items);
  };

  const deleteLog = (id) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    resolveRowId(id)
      .then((realId) => supabase.from("food_logs").delete().eq("id", realId))
      .catch(() => {});
  };

  const openEditModal = (log) => {
    setCurrentLogToEdit(log);
    setEditQty(log.qty);
    setIsEditingLog(true);
  };

  const saveLogEdit = async () => {
    if (!currentLogToEdit) return;
    const target = currentLogToEdit; // snapshot — state is cleared below
    const newQ = Number(editQty);
    setIsEditingLog(false);
    setCurrentLogToEdit(null);

    if (!(newQ > 0)) {
      deleteLog(target.id);
      return;
    }
    if (newQ === target.qty) return; // nothing changed

    const ratio = newQ / target.qty;
    const patch = {
      qty: newQ,
      calories: Math.round(target.calories * ratio),
      protein: Math.round(target.protein * ratio),
      carbs: Math.round(target.carbs * ratio),
      fats: Math.round(target.fats * ratio),
      fiber: Math.round((target.fiber || 0) * ratio),
    };

    // optimistic
    setLogs((prev) => prev.map((l) => (l.id === target.id ? { ...l, ...patch } : l)));
    setSaveError("");

    // restore the row to its pre-edit values if the write doesn't stick
    const rollback = () =>
      setLogs((prev) =>
        prev.map((l) =>
          l.id === target.id
            ? { ...l, qty: target.qty, calories: target.calories, protein: target.protein, carbs: target.carbs, fats: target.fats, fiber: target.fiber }
            : l,
        ),
      );

    try {
      const realId = await resolveRowId(target.id);
      // .select() lets us detect an update that returns NO error but changes 0
      // rows — the signature of a missing UPDATE RLS policy (a silent no-op).
      const runUpdate = () =>
        supabase.from("food_logs").update(patch).eq("id", realId).select();
      let { data, error } = await runUpdate();
      if (error) {
        await new Promise((r) => setTimeout(r, 500));
        ({ data, error } = await runUpdate());
      }
      if (error) {
        console.error("Edit failed:", error);
        setSaveError(`Couldn't update "${target.name}": ${error.message}`);
        rollback();
      } else if (!data || data.length === 0) {
        setSaveError(
          `"${target.name}" didn't update — the change wasn't allowed to save. Run docs/fix-edit-log.sql, then try again.`,
        );
        rollback();
      }
    } catch (e) {
      console.error("Edit failed:", e);
      setSaveError(`Couldn't update "${target.name}": ${e?.message || e}`);
      rollback();
    }
  };

  // ── Daily quests (Phase 3) — derived from today's logs; reset at midnight ──
  const mealCount = useMemo(
    () => logs.filter((l) => l.name !== "Water").length,
    [logs],
  );
  const quests = useMemo(
    () =>
      computeQuests({
        totals,
        targets: calculateTargets(userProfile, conditions),
        mealCount,
      }),
    [totals, userProfile, conditions, mealCount],
  );
  // Celebrate a quest the moment it flips to complete — but not the ones already
  // complete when the page loads.
  useEffect(() => {
    const doneNow = completedQuestIds(quests);
    if (questPrevRef.current === null) {
      questPrevRef.current = doneNow;
      return;
    }
    for (const q of quests) {
      if (q.done && !questPrevRef.current.has(q.id)) {
        setCelebration({ id: Date.now(), kind: "quest", icon: q.icon, title: q.title });
        if (q.xp) awardXp(q.xp); // bonus XP for finishing the goal
      }
    }
    questPrevRef.current = doneNow;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quests]);

  const level = useMemo(() => levelFromXp(totalXp), [totalXp]);

  // ── Capture shortcuts (Phase 2) ─────────────────────────────────────────────
  const handleVoice = () => router.push("/voice");
  const handleSearchFocus = () => {
    const sec = document.querySelector(".command-center");
    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    const input = document.querySelector(".command-center input");
    if (input) setTimeout(() => input.focus(), 300);
  };
  const handleSnap = (file) => {
    // Hand the photo to the AI Coach, which identifies items and logs them.
    const reader = new FileReader();
    reader.onload = () => {
      try {
        sessionStorage.setItem("nt_meal_photo", String(reader.result));
      } catch {
        /* storage blocked — the coach still opens */
      }
      router.push("/agent?photo=1");
    };
    reader.readAsDataURL(file);
  };

  const openMealBuilder = (mealToEdit = null) => {
    if (mealToEdit) {
      setEditingMealId(mealToEdit.id);
      setNewMealName(mealToEdit.name);
      setMealBuilderItems(mealToEdit.items);
    } else {
      setEditingMealId(null);
      setNewMealName("");
      setMealBuilderItems([]);
    }
    setIsCreatingMeal(true);
  };
  const addItemToBuilder = (foodName) => {
    const existing = mealBuilderItems.find((i) => i.name === foodName);
    if (existing)
      setMealBuilderItems(
        mealBuilderItems.map((i) =>
          i.name === foodName ? { ...i, qty: i.qty + 1 } : i,
        ),
      );
    else setMealBuilderItems([...mealBuilderItems, { name: foodName, qty: 1 }]);
  };
  const removeItemFromBuilder = (index) => {
    const newItems = [...mealBuilderItems];
    newItems.splice(index, 1);
    setMealBuilderItems(newItems);
  };
  const saveBuiltMeal = async () => {
    if (!newMealName || mealBuilderItems.length === 0)
      return alert("Invalid meal");
    if (editingMealId) {
      await supabase
        .from("saved_meals")
        .update({ name: newMealName, items: mealBuilderItems })
        .eq("id", editingMealId);
      setSavedMeals(
        savedMeals.map((m) =>
          m.id === editingMealId
            ? { ...m, name: newMealName, items: mealBuilderItems }
            : m,
        ),
      );
    } else {
      const { data } = await supabase
        .from("saved_meals")
        .insert([
          {
            name: newMealName,
            items: mealBuilderItems,
            user_id: session.user.id,
          },
        ])
        .select();
      if (data) setSavedMeals([...savedMeals, data[0]]);
    }
    setIsCreatingMeal(false);
  };
  const deleteMeal = async (id) => {
    if (!confirm("Delete?")) return;
    setSavedMeals(savedMeals.filter((m) => m.id !== id));
    await supabase.from("saved_meals").delete().eq("id", id);
  };

  useEffect(() => {
    const t = logs.reduce(
      (acc, item) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        protein: acc.protein + (Number(item.protein) || 0),
        carbs: acc.carbs + (Number(item.carbs) || 0),
        fats: acc.fats + (Number(item.fats) || 0),
        fiber: acc.fiber + (Number(item.fiber) || 0),
        water: item.name === "Water" ? acc.water + item.qty : acc.water,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, water: 0 },
    );
    setTotals({
      calories: Math.round(t.calories),
      protein: Math.round(t.protein * 10) / 10,
      carbs: Math.round(t.carbs * 10) / 10,
      fats: Math.round(t.fats * 10) / 10,
      fiber: Math.round(t.fiber * 10) / 10,
      water: Math.round(t.water * 10) / 10,
    });
  }, [logs]);

  const getDisplayItems = () => {
    const hydrate = (keys) =>
      keys.map((key) => {
        const item =
          COMBINED_DB[key.toLowerCase()] ||
          COMBINED_DB[
            Object.keys(COMBINED_DB).find((k) => k.includes(key.toLowerCase()))
          ];
        return item ? { name: key, ...item } : { name: key };
      });

    if (query) {
      const keys = Object.keys(COMBINED_DB).filter((k) =>
        k.includes(query.toLowerCase()),
      );
      const results = hydrate(keys);

      if (results.length === 0) {
        if (isWebSearching) {
          return [{ id: "loading", name: "Searching Web...", isWeb: true }];
        }
        if (webResults.length > 0) {
          return webResults;
        }
        return [
          {
            id: "no-res",
            name: "No results. Try standardizing name.",
            isWeb: true,
          },
        ];
      }
      return results;
    }

    if (activeCategory === "Smart") {
      return smartRecommendations.length > 0
        ? smartRecommendations
        : [
            {
              id: "smart-empty",
              name: "Goal Met! Have some water.",
              type: "meal",
              items: [],
              isSmart: true,
            },
          ];
    }

    if (activeCategory === "Recent") {
      return hydrate(recents);
    }

    if (activeCategory === "Meals") {
      return savedMeals;
    }

    const catKeys = Object.keys(FOOD_CATEGORIES[activeCategory] || {});
    return hydrate(catKeys);
  };

  const getBuilderSuggestions = () =>
    mealBuilderQuery
      ? Object.keys(COMBINED_DB).filter((k) =>
          k.includes(mealBuilderQuery.toLowerCase()),
        )
      : recents;

  const handleSendCode = async (e) => {
    e.preventDefault();
    const result = await sendOtp(email);
    if (!result.ok) alert(result.error);
    else setIsCodeSent(true);
  };
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    const result = await verifyOtp(email, otp);
    if (!result.ok) alert("Invalid code.");
    else setShowPasswordSetup(true);
  };
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    const result = await signInWithPassword(email, password);
    if (!result.ok) alert(result.error);
  };

  // Hold on a branded splash until we know whether a session exists. Without
  // this, session is null on first paint and returning users get a flash of the
  // marketing/login page before the app appears.
  if (initializing) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#08080a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Flame size={28} color="#fff" fill="#fff" />
        </div>
        <Loader2 className="animate-spin" size={18} color="#3b82f6" />
      </div>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        showAuth={showAuth}
        setShowAuth={setShowAuth}
        usePasswordLogin={usePasswordLogin}
        setUsePasswordLogin={setUsePasswordLogin}
        isCodeSent={isCodeSent}
        setIsCodeSent={setIsCodeSent}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        otp={otp}
        setOtp={setOtp}
        authLoading={authLoading}
        signInWithGoogle={signInWithGoogle}
        handlePasswordLogin={handlePasswordLogin}
        handleSendCode={handleSendCode}
        handleVerifyCode={handleVerifyCode}
      />
    );
  }
  return (
    <div
      className="app-wrapper"
      style={{
        minHeight: "100vh",
        // Kill the .app-wrapper CSS *horizontal* padding (sections own their
        // own 20px sides) so the sticky header reaches the screen edges and
        // content isn't double-inset — but keep a real vertical gap so the
        // stacked cards breathe instead of sitting wall-to-wall.
        padding: 0,
        gap: 14,
        paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))",
        width: "100%",
        overflowX: "hidden",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* MANUAL ENTRY MODAL */}
      {isManualEntryOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div
            className="modal-content"
            style={{ maxWidth: 350, width: "90%", textAlign: "left" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <PlusCircle size={20} color="#3b82f6" /> Add Custom Food
              </h3>
              <button
                onClick={() => setIsManualEntryOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#666",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleManualAddSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    fontSize: "0.8rem",
                    color: "#888",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Food Name *
                </label>
                <input
                  required
                  placeholder="e.g. Grandma's Pasta"
                  value={manualFood.name}
                  onChange={(e) =>
                    setManualFood({ ...manualFood, name: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: 10,
                    background: "#000",
                    border: "1px solid #333",
                    color: "#fff",
                    borderRadius: 8,
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      color: "#888",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Calories *
                  </label>
                  <input
                    required
                    type="number"
                    placeholder="kcal"
                    value={manualFood.calories}
                    onChange={(e) =>
                      setManualFood({ ...manualFood, calories: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: 10,
                      background: "#000",
                      border: "1px solid #333",
                      color: "#fff",
                      borderRadius: 8,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      color: "#888",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    placeholder="g"
                    value={manualFood.protein}
                    onChange={(e) =>
                      setManualFood({ ...manualFood, protein: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: 10,
                      background: "#000",
                      border: "1px solid #333",
                      color: "#fff",
                      borderRadius: 8,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      color: "#888",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Carbs (g)
                  </label>
                  <input
                    type="number"
                    placeholder="g"
                    value={manualFood.carbs}
                    onChange={(e) =>
                      setManualFood({ ...manualFood, carbs: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: 10,
                      background: "#000",
                      border: "1px solid #333",
                      color: "#fff",
                      borderRadius: 8,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      color: "#888",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Fats (g)
                  </label>
                  <input
                    type="number"
                    placeholder="g"
                    value={manualFood.fats}
                    onChange={(e) =>
                      setManualFood({ ...manualFood, fats: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: 10,
                      background: "#000",
                      border: "1px solid #333",
                      color: "#fff",
                      borderRadius: 8,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      color: "#888",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Fiber (g)
                  </label>
                  <input
                    type="number"
                    placeholder="g"
                    value={manualFood.fiber}
                    onChange={(e) =>
                      setManualFood({ ...manualFood, fiber: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: 10,
                      background: "#000",
                      border: "1px solid #333",
                      color: "#fff",
                      borderRadius: 8,
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: 12,
                  background: "var(--brand)",
                  border: "none",
                  color: "#fff",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save & Log
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FIRST-RUN ONBOARDING / GOAL SETTER */}
      {showOnboarding && (
        <OnboardingModal
          initialProfile={userProfile}
          username={username}
          onComplete={completeOnboarding}
        />
      )}

      {/* PASSWORD & USERNAME MODAL */}
      {showPasswordSetup && (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{ maxWidth: 400, width: "90%", textAlign: "center" }}
          >
            <KeyRound size={40} color="#3b82f6" style={{ marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px 0" }}>Account Setup</h3>
            <p style={{ color: "#888", marginBottom: 20, fontSize: "0.9rem" }}>
              Set a username and password to secure your account.
            </p>

            <input
              type="text"
              placeholder="Username (e.g. GymRat99)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                background: "#000",
                border: "1px solid #444",
                color: "#fff",
                borderRadius: 8,
                marginBottom: 10,
              }}
            />
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                background: "#000",
                border: "1px solid #444",
                color: "#fff",
                borderRadius: 8,
                marginBottom: 10,
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowPasswordSetup(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  background: "transparent",
                  border: "1px solid #333",
                  borderRadius: 8,
                  color: "#888",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePassword}
                style={{
                  flex: 1,
                  padding: 12,
                  background: "var(--brand)",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT LOG MODAL (NEW) */}
      {isEditingLog && currentLogToEdit && (
        <div className="modal-overlay" style={{ alignItems: "center" }}>
          <div
            className="modal-content"
            style={{
              maxWidth: 320,
              width: "88%",
              textAlign: "center",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                color: "#666",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Modify Quantity
            </div>
            <h3
              style={{
                margin: "0 0 4px 0",
                fontSize: "1rem",
                color: "#fff",
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentLogToEdit.name}
            </h3>
            <div
              style={{ color: "#555", fontSize: "0.8rem", marginBottom: 24 }}
            >
              {currentLogToEdit.calories} kcal per serving
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 24,
                marginBottom: 28,
              }}
            >
              <button
                className="qty-btn"
                onClick={() => setEditQty(Math.max(0.5, editQty - 0.5))}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "#1a1a1f",
                  border: "1px solid #2a2a30",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Minus size={18} />
              </button>
              <div>
                <div
                  style={{
                    fontSize: "2.2rem",
                    fontWeight: 800,
                    color: "#fff",
                    lineHeight: 1,
                  }}
                >
                  {editQty}
                </div>
                <div
                  style={{ fontSize: "0.7rem", color: "#555", marginTop: 2 }}
                >
                  = {Math.round((currentLogToEdit.calories / (currentLogToEdit.qty || 1)) * editQty)} kcal
                </div>
              </div>
              <button
                className="qty-btn"
                onClick={() => setEditQty(editQty + 0.5)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "#1a1a1f",
                  border: "1px solid #2a2a30",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Plus size={18} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setIsEditingLog(false)}
                style={{
                  flex: 1,
                  padding: 13,
                  background: "transparent",
                  border: "1px solid #2a2a30",
                  borderRadius: 12,
                  color: "#666",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveLogEdit}
                style={{
                  flex: 1,
                  padding: 13,
                  background: "var(--brand)",
                  border: "none",
                  borderRadius: 12,
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingGoal && (
        <SettingsModal
          conditions={conditions}
          setIsSettingGoal={setIsSettingGoal}
          settingsTab={settingsTab}
          setSettingsTab={setSettingsTab}
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          username={username}
          setUsername={setUsername}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          handleUpdatePassword={handleUpdatePassword}
          saveGoal={saveGoal}
        />
      )}

      {/* MEAL BUILDER */}
      {isCreatingMeal && (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{ maxWidth: 400, width: "90%" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0 }}>
                {editingMealId ? "Edit Meal" : "Build a Meal"}
              </h3>
              <button
                onClick={() => setIsCreatingMeal(false)}
                style={{ background: "none", border: "none", color: "#666" }}
              >
                <X size={20} />
              </button>
            </div>
            <input
              autoFocus
              placeholder="Meal Name"
              value={newMealName}
              onChange={(e) => setNewMealName(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 16,
                background: "#000",
                border: "1px solid #333",
                color: "#fff",
                borderRadius: 8,
              }}
            />
            <div
              style={{
                background: "#000",
                borderRadius: 8,
                border: "1px solid #333",
                padding: 10,
                marginBottom: 16,
                minHeight: 100,
                maxHeight: 150,
                overflowY: "auto",
              }}
            >
              {mealBuilderItems.length === 0 ? (
                <div
                  style={{
                    color: "#666",
                    textAlign: "center",
                    marginTop: 30,
                  }}
                >
                  Add items below
                </div>
              ) : (
                mealBuilderItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: "1px solid #222",
                    }}
                  >
                    <span>
                      {item.qty}x {item.name}
                    </span>
                    <button
                      onClick={() => removeItemFromBuilder(idx)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#000",
                  border: "1px solid #333",
                  borderRadius: 8,
                  padding: "0 10px",
                }}
              >
                <Search size={14} color="#666" />
                <input
                  placeholder="Search food..."
                  value={mealBuilderQuery}
                  onChange={(e) => setMealBuilderQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    color: "#fff",
                    padding: 10,
                    outline: "none",
                  }}
                />
              </div>
              {mealBuilderQuery && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    maxHeight: 100,
                    overflowY: "auto",
                  }}
                >
                  {getBuilderSuggestions().map((item) => (
                    <button
                      key={item}
                      onClick={() => addItemToBuilder(item)}
                      style={{
                        background: "#27272a",
                        border: "1px solid #333",
                        color: "#ddd",
                        padding: "4px 10px",
                        borderRadius: 20,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={saveBuiltMeal}
              style={{
                width: "100%",
                padding: 12,
                background: "var(--brand)",
                border: "none",
                color: "#fff",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Save size={16} style={{ display: "inline", marginRight: 6 }} />{" "}
              Save Meal
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header
        className="header-row"
        style={{
          // viewportFit:"cover" lets the page draw under the status bar/notch,
          // so the sticky header must pad the top inset or it hides behind the
          // iOS clock/battery (the bottom nav already pads its own inset).
          padding: "calc(14px + env(safe-area-inset-top, 0px)) 20px 12px",
          borderBottom: "1px solid #1a1a1e",
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(8,8,10,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxSizing: "border-box",
        }}
      >
        {/* Left: branding + greeting */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Flame size={20} color="#fff" fill="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {username ? `Hey, ${username} 👋` : "NutriTrack"}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 2,
                flexWrap: "wrap",
              }}
            >
              <div className="date-badge" style={{ fontSize: "0.7rem" }}>
                Today
              </div>
              {streak > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "rgba(245,158,11,0.12)",
                    border: "1px solid rgba(245,158,11,0.25)",
                    borderRadius: 10,
                    padding: "1px 8px",
                    fontSize: "0.72rem",
                    color: "#f59e0b",
                    fontWeight: 700,
                  }}
                >
                  <Flame size={11} fill="#f59e0b" color="#f59e0b" /> {streak}d
                </div>
              )}
              {/* Level + XP (Phase 3) */}
              <div
                title={`${level.into}/${level.needed} XP`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.25)",
                  borderRadius: 10,
                  padding: "1px 8px",
                  fontSize: "0.72rem",
                  color: "#a78bfa",
                  fontWeight: 800,
                }}
              >
                LV {level.level}
                <span
                  style={{
                    width: 28,
                    height: 4,
                    borderRadius: 99,
                    background: "rgba(139,92,246,0.25)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${level.pct}%`,
                      background: "linear-gradient(90deg,#8b5cf6,#3b82f6)",
                      transition: "width .6s cubic-bezier(.2,.8,.2,1)",
                    }}
                  />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => {
              setIsSettingGoal(true);
              setSettingsTab("profile");
            }}
            style={{
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.25)",
              color: "#3b82f6",
              cursor: "pointer",
              padding: "8px 14px",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            <Target size={15} /> Goal
          </button>
          <button
            onClick={() => {
              setIsSettingGoal(true);
              setSettingsTab("security");
            }}
            style={{
              background: "#111113",
              border: "1px solid #27272a",
              color: "#666",
              cursor: "pointer",
              padding: 9,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {saveError && (
        <div style={{ padding: "10px 20px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: "0.78rem",
              color: "#fca5a5",
              lineHeight: 1.45,
            }}
          >
            <span style={{ flex: 1 }}>
              <b style={{ color: "#ef4444" }}>Log didn&apos;t save.</b> {saveError}
            </span>
            <button
              onClick={() => setSaveError("")}
              style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontWeight: 800, flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <StatsBoard
        conditions={conditions}
        totals={totals}
        onAddWater={() => addFood("Water")}
        userProfile={userProfile}
      />

      {/* Weight sits with the other daily metrics (calories/macros/water),
          right under the stats — a quick morning weigh-in without scrolling,
          and out of the food-logging flow (capture → log food) below. */}
      {/* === WEIGHT TRACKER CARD === */}
      <section style={{ padding: "12px 20px 0" }}>
        <div
          style={{
            background: "linear-gradient(180deg, #15151b, #0f0f13)",
            borderRadius: 18,
            padding: "16px 18px",
            border: "1px solid #1e1e26",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              background: "rgba(236,72,153,0.12)",
              border: "1px solid rgba(236,72,153,0.2)",
              padding: 10,
              borderRadius: 12,
              flexShrink: 0,
            }}
          >
            <Scale size={20} color="#ec4899" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 6,
              }}
            >
              <span
                style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff" }}
              >
                Today&apos;s Weight
              </span>
              <span
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "#ec4899",
                }}
              >
                {userProfile.weight || "--"}{" "}
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#555",
                    fontWeight: 600,
                  }}
                >
                  kg
                </span>
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                step="0.1"
                placeholder="Log weight..."
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "#0a0a0c",
                  border: "1px solid #27272a",
                  color: "#fff",
                  outline: "none",
                  fontSize: "0.9rem",
                }}
              />
              <button
                onClick={handleLogWeight}
                disabled={isLoggingWeight || !weightInput}
                style={{
                  padding: "8px 16px",
                  background: weightInput
                    ? "linear-gradient(135deg, #ec4899, #8b5cf6)"
                    : "#1e1e26",
                  color: weightInput ? "#fff" : "#444",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: weightInput ? "pointer" : "not-allowed",
                  fontSize: "0.85rem",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isLoggingWeight ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Phase 2: fast capture — snap / say / search — leads into the logger */}
      <CaptureBar
        onSnap={handleSnap}
        onVoice={handleVoice}
        onSearch={handleSearchFocus}
      />

      <FoodLogger
        query={query}
        setQuery={setQuery}
        qty={qty}
        setQty={setQty}
        selectedMeal={selectedMeal}
        setSelectedMeal={setSelectedMeal}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        aiMealPlan={aiMealPlan}
        setAiMealPlan={setAiMealPlan}
        aiMealPlanLoading={aiMealPlanLoading}
        fetchAiMealPlan={fetchAiMealPlan}
        COMBINED_DB={COMBINED_DB}
        getDisplayItems={getDisplayItems}
        savedMeals={savedMeals}
        openMealBuilder={openMealBuilder}
        loadMeal={loadMeal}
        deleteMeal={deleteMeal}
        addFood={addFood}
        saveCustomFoodToDb={saveCustomFoodToDb}
        manualFood={manualFood}
        setManualFood={setManualFood}
        setIsManualEntryOpen={setIsManualEntryOpen}
      />

      {/* Phase 3: today's quests */}
      <QuestsCard quests={quests} />

      {/* TIMELINE */}
      <Timeline
        logs={logs}
        loading={loading}
        totals={totals}
        userProfile={userProfile}
        openEditModal={openEditModal}
        deleteLog={deleteLog}
      />

      {/* Phase 0/1/3: reward bursts, auto-save Undo toast, celebrations */}
      <RewardLayer
        floats={floats}
        onFloatDone={(id) => setFloats((f) => f.filter((x) => x.id !== id))}
        toast={toast}
        onUndo={undoLastAdd}
        celebration={celebration}
        onCelebrationDone={() => setCelebration(null)}
      />
    </div>
  );
}

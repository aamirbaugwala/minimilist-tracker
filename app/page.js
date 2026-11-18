"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Flame,
} from "lucide-react";
import { FLATTENED_DB } from "./food-data";
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
import Timeline from "./components/Timeline";
import RewardLayer from "./components/RewardLayer";
import QuestsCard from "./components/QuestsCard";
import CaptureBar from "./components/CaptureBar";
import LogFoodSheet from "./components/LogFoodSheet";
import BarcodeScanner from "./components/BarcodeScanner";
import TodayHeader from "./components/TodayHeader";
import BodyTiles from "./components/BodyTiles";
import CoachNudge from "./components/CoachNudge";
import FirstWeekGuide from "./components/FirstWeekGuide";
import InstallPrompt from "./components/InstallPrompt";
import DayWrap from "./components/DayWrap";
import { EditLogSheet, CustomFoodSheet, MealBuilderSheet, SnapSheet, AccountSetupSheet, SnapPromptSheet, RepeatMealSheet } from "./components/TodaySheets";
import { computeStreak, weekOf } from "./lib/streak";
import { useNotifications } from "./hooks/useNotifications";
import QuickAddRow from "./components/QuickAddRow";
import { saveProfileGoal, saveUsername } from "./lib/profileActions";
import { defaultMeal, MEALS } from "./lib/mealPeriod";
import { dayKey } from "./lib/day";
import { uuid } from "./lib/uuid";
import { insertFoodLogs } from "./lib/foodLogInsert";
import { compressImage } from "./lib/image";
import {
  xpForLog,
  levelFromXp,
  didLevelUp,
  computeQuests,
  completedQuestIds,
} from "./lib/gamification";

// The app's "today" — a local day that rolls over at 4am (see lib/day.js), so
// late-night meals stay on the day you were awake for and every page agrees.
const localDateKey = (d) => dayKey(d);

/**
 * Deep links from push nudges and home-screen shortcuts:
 *   ?log=<Meal>     open the food sheet on that meal
 *   ?snap=<Meal|1>  one-tap camera prompt (browsers need a tap to open it)
 *   ?repeat=<Meal>  "same as yesterday" confirm
 *   ?water=1        add a glass right away (Undo toast as usual)
 * Read in state initialisers (the server renders the splash first, so there's
 * no markup to mismatch); the param is stripped once handled.
 */
function readUrlAction() {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const meal = (v) => {
    const label = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
    return MEALS.some((x) => x.label === label) ? label : defaultMeal();
  };
  for (const type of ["log", "snap", "repeat"]) if (q.get(type)) return { type, meal: meal(q.get(type)) };
  if (q.get("water")) return { type: "water" };
  return null;
}
const clearUrlAction = () => {
  if (typeof window !== "undefined" && window.location.search) {
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }
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
  // Surfaces a real save failure instead of swallowing it into the console.
  const [saveError, setSaveError] = useState("");

  // ── Snap-a-plate: in-place photo identify + confirm (no navigation) ─────────
  // Food logger bottom sheet: null = closed, { focus } = open (focus → raise
  // the keyboard on the search box, for the Search shortcut).
  // ?log=<Meal> (meal-time push nudges, home-screen shortcut) opens the sheet
  // on that meal. Read in the initialiser, not an effect: the server always
  // renders the splash first, so there is no markup to mismatch.
  const [logSheet, setLogSheet] = useState(() => (readUrlAction()?.type === "log" ? { focus: false } : null));
  const [scanOpen, setScanOpen] = useState(false);
  const [snapPrompt, setSnapPrompt] = useState(() => readUrlAction()?.type === "snap");
  const [repeatPrompt, setRepeatPrompt] = useState(() => (readUrlAction()?.type === "repeat" ? readUrlAction().meal : null));
  const [waterFromUrl] = useState(() => readUrlAction()?.type === "water");
  const waterHandledRef = useRef(false);
  const [logsReady, setLogsReady] = useState(false); // first fetch of today's logs finished
  const [snapOpen, setSnapOpen] = useState(false);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapItems, setSnapItems] = useState([]);        // [{ name, qty, calories, protein, ... }]
  const [snapImage, setSnapImage] = useState(null);      // { base64, mimeType, dataUrl }
  const [snapError, setSnapError] = useState("");
  const [snapCorrection, setSnapCorrection] = useState("");

  // ── Phase 1/3: reward + game state ──────────────────────────────────────────
  const [floats, setFloats] = useState([]); // floating +kcal / +XP bursts
  const [toast, setToast] = useState(null); // { name } — auto-save + undo
  const [celebration, setCelebration] = useState(null); // quest / level-up
  const totalXpRef = useRef(0);
  const lastAddRef = useRef(null); // last batch, for Undo
  const pendingRef = useRef({}); // tempId -> Promise<realId> (insert reconcile)
  const recentMacrosRef = useRef({}); // recent name -> per-unit macros of its last log
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
  const [loggedDates, setLoggedDates] = useState([]); // YYYY-MM-DD, last 120 days
  const [yesterdayByMeal, setYesterdayByMeal] = useState(null); // { Lunch: { items, kcal } } · null = not loaded

  // Modals
  const [isCreatingMeal, setIsCreatingMeal] = useState(false);
  const [isSettingGoal, setIsSettingGoal] = useState(false);
  const [settingsTab, setSettingsTab] = useState("profile");
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);

  // --- EDIT LOG STATE ---
  const [isEditingLog, setIsEditingLog] = useState(false);
  const [currentLogToEdit, setCurrentLogToEdit] = useState(null);
  const [editQty, setEditQty] = useState(1);
  const [editMeal, setEditMeal] = useState("Breakfast"); // move an entry to another meal

  // --- CUSTOM FOODS & MANUAL ENTRY STATE ---
  const [customFoods, setCustomFoods] = useState([]);
  // Derived from the user's blood work; empty when they have no reports.
  // Conditions from blood reports; merged with self-reported ones below.
  const [biomarkerConditions, setBiomarkerConditions] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualAddNow, setManualAddNow] = useState(true); // custom food: also log 1 now
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
  const [selectedMeal, setSelectedMeal] = useState(() => readUrlAction()?.meal || defaultMeal());
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


  // --- FEATURE 1: SMART RECOMMENDATIONS (the food sheet's "Suggested" tab) ---
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

  // Only needed while the food sheet is open — skip the full-DB scan otherwise.
  const sheetOpen = !!logSheet;
  const smartRecommendations = useMemo(
    () => (sheetOpen ? generateSmartMeals() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheetOpen, totals, userProfile, COMBINED_DB],
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
            `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`,
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
        // Only backfill legacy rows (no fiber, or saved before `source` existed).
        // A 0 on a current row is real — re-deriving it by name × qty (qty may
        // be pieces, not servings) made totals jump after a refresh.
        if (log.fiber > 0 || (log.fiber != null && log.source)) return log;
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
      // Keep rows the user added while this fetch was in flight (their insert
      // is still pending, so the snapshot can't contain them yet).
      setLogs((prev) => {
        const fetched = new Set(enrichedLogs.map((l) => l.id));
        const inFlight = prev.filter((l) => pendingRef.current[l.id] && !fetched.has(l.id));
        return [...inFlight, ...enrichedLogs];
      });
      setLogsReady(true);
    }

    const { data: history } = await supabase
      .from("food_logs")
      .select("name, qty, calories, protein, carbs, fats, fiber")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (history) {
      // Voice/Snap/recipe rows are stored under names that aren't food-DB keys
      // ("almonds", a recipe title). Remember each recent's per-unit macros from
      // its latest row so Quick add re-logs what was actually logged instead of
      // a substring guess (or 0 kcal).
      const perUnit = {};
      history.forEach((h) => {
        const q = Number(h.qty) || 1;
        if (h.name && !perUnit[h.name])
          perUnit[h.name] = {
            calories: (Number(h.calories) || 0) / q,
            protein: (Number(h.protein) || 0) / q,
            carbs: (Number(h.carbs) || 0) / q,
            fats: (Number(h.fats) || 0) / q,
            fiber: (Number(h.fiber) || 0) / q,
          };
      });
      recentMacrosRef.current = perUnit;
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
      totalXpRef.current = xp; // level isn't shown on Today in Direction A

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

  // Logged days (for the streak) + yesterday's meals (for "Same as yesterday").
  // The streak itself is derived below from these dates plus today's live logs,
  // so it updates the moment the first item of the day is logged.
  const calculateStreak = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const today = localDateKey();
    const yesterday = localDateKey(new Date(Date.now() - 86400000));
    const windowStart = localDateKey(new Date(Date.now() - 120 * 86400000));

    const [{ data: dates }, { data: yLogs }] = await Promise.all([
      supabase
        .from("food_logs")
        .select("date")
        .eq("user_id", session.user.id)
        .gte("date", windowStart)
        .lte("date", today)
        .order("date", { ascending: false }),
      supabase
        .from("food_logs")
        .select("name, qty, calories, protein, carbs, fats, fiber, meal, created_at")
        .eq("user_id", session.user.id)
        .eq("date", yesterday)
        .order("created_at", { ascending: true }),
    ]);

    setLoggedDates([...new Set((dates || []).map((d) => d.date))]);

    const byMeal = {};
    (yLogs || [])
      .filter((l) => l.name !== "Water")
      .forEach((l) => {
        const meal = l.meal || defaultMeal(l.created_at);
        if (!byMeal[meal]) byMeal[meal] = { items: [], kcal: 0 };
        byMeal[meal].items.push(l);
        byMeal[meal].kcal += Number(l.calories) || 0;
      });
    setYesterdayByMeal(byMeal);
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

  // A home screen left open (or backgrounded as a PWA) across 4 am kept showing
  // yesterday's logs as "today" until a full reload; and the meal picker kept
  // the meal from whenever the page mounted. Re-check on focus and every minute:
  // a new logical day refetches today; a new meal period moves the picker on
  // (an explicit pick inside the same period is left alone).
  const loadedDayRef = useRef(localDateKey());
  const mealPeriodRef = useRef(defaultMeal());
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const day = localDateKey();
      if (day !== loadedDayRef.current) {
        loadedDayRef.current = day;
        lastAddRef.current = null; // Undo shouldn't reach into yesterday
        fetchData(true);
        calculateStreak();
      }
      const period = defaultMeal();
      if (period !== mealPeriodRef.current) {
        mealPeriodRef.current = period;
        setSelectedMeal(period);
      }
    };
    const onVisible = () => document.visibilityState === "visible" && tick();
    const timer = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
      effective_from: localDateKey(), // the app's 4 am day, like every log
    });
    setUserProfile((prev) => ({ ...prev, ...payload }));
    setShowOnboarding(false);
  };

  const saveGoal = async () => {
    const result = await saveProfileGoal(session.user.id, userProfile);
    if (!result.ok) return alert(result.error);
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
      const saved = await saveUsername(session.user.id, username);
      if (!saved.ok) return alert(saved.error);
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
    const today = localDateKey(); // the app's 4 am local day, not the UTC date
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
      return true;
    } catch (err) {
      console.error(err);
      alert("Failed to log weight");
      return false;
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
    e?.preventDefault?.();
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
    if (manualAddNow) addFood(formattedFood.name, 1, formattedFood, "custom");

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
          { id: base + "a", text: `+${kcal}`, color: "var(--text)", dx: -34 },
          { id: base + "b", text: `+${xp} XP`, color: "var(--accent-text)", dx: 22 },
        ]
      : [{ id: base + "b", text: `+${xp} XP`, color: "var(--accent-text)", dx: -18 }];
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
    const attempt = () => insertFoodLogs(supabase, row);
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
  // Shared commit path for a batch of ready-to-insert rows (final macros, real
  // UUID ids): optimistic UI, reward side-effects (isolated so a throw can never
  // skip persistence — the original data-loss bug), then insert each row. Used
  // by manual/search logging AND the Snap-a-plate confirm flow.
  const commitRows = (rows) => {
    if (!rows.length) return;
    const idSet = new Set(rows.map((r) => r.id));

    // optimistic — newest first
    setLogs((prev) => [...rows.slice().reverse(), ...prev]);

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
    // to reconcile — on success we clear the pending marker; on failure we roll
    // the row back and surface the reason. pendingRef lets a delete/undo that
    // fires before the insert finishes wait for it (same id throughout).
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

  const handleLocalAdd = (itemsToAdd, source = "sheet") => {
    if (!session) return;
    const createdAt = new Date().toISOString();
    const dateKey = localDateKey(); // local calendar day, not UTC
    setSaveError("");

    // Each item can carry its own meal (the food sheet's cart can hold picks
    // for several meals); otherwise it goes under the meal that's selected.
    const fallbackMeal = selectedMeal || defaultMeal(createdAt);
    const newId = uuid;
    const rows = itemsToAdd.map((item) => {
      const meal = MEALS.some((m) => m.label === item.meal) ? item.meal : fallbackMeal;
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
        source,
        date: dateKey,
        created_at: createdAt,
        user_id: session.user.id,
      };
    });
    commitRows(rows);
  };

  // Log the foods the user confirmed from a Snap-a-plate photo. identify-meal
  // returns FINAL (qty-multiplied) macros, so build rows directly — do NOT
  // re-scale by qty the way handleLocalAdd does for per-serving DB foods.
  // `mealOverride` files the batch under a specific meal (e.g. "Same as
  // yesterday's lunch" logged while the picker says something else).
  const logIdentifiedItems = (items, mealOverride, source = "snap") => {
    if (!session || !items.length) return;
    setSaveError("");
    const createdAt = new Date().toISOString();
    const dateKey = localDateKey();
    const meal = mealOverride || selectedMeal || defaultMeal(createdAt);
    const newId = uuid;
    const rows = items.map((item) => ({
      id: newId(),
      name: item.name,
      qty: Number(item.qty) || 1,
      calories: Math.round(item.calories || 0),
      protein: Math.round(item.protein || 0),
      carbs: Math.round(item.carbs || 0),
      fats: Math.round(item.fats || 0),
      fiber: Math.round(item.fiber || 0),
      meal,
      source,
      date: dateKey,
      created_at: createdAt,
      user_id: session.user.id,
    }));
    commitRows(rows);
  };

  const undoLastAdd = () => {
    const last = lastAddRef.current;
    if (!last) return;
    const ids = [...last.idSet]; // snapshot; may be temp or reconciled
    ids.forEach((id) => deleteLog(id));
    awardXp(-last.xp);
    lastAddRef.current = null;
    setToast(null);
  };

  const addFood = (foodName, overrideQty = null, explicitMacros = null, source = "sheet") => {
    handleLocalAdd([{ name: foodName, qty: overrideQty || qty, ...explicitMacros }], source);
    if (!overrideQty && foodName !== "Water") {
      setQty(1);
      setQuery("");
    }
  };
  // Optimistic remove; supabase reports failures in `error` (it doesn't
  // reject), so check it and put the row back rather than silently diverging.
  const deleteLog = (id) => {
    let removed = null;
    setLogs((prev) => {
      removed = prev.find((l) => l.id === id) || removed;
      return prev.filter((l) => l.id !== id);
    });
    const restore = (err) => {
      console.error("Delete failed:", err);
      setSaveError(`Couldn't remove "${removed?.name || "that item"}": ${err?.message || err}`);
      if (removed) setLogs((prev) => (prev.some((l) => l.id === id) ? prev : [removed, ...prev]));
    };
    resolveRowId(id)
      .then((realId) => supabase.from("food_logs").delete().eq("id", realId))
      .then(({ error } = {}) => error && restore(error))
      .catch(restore);
  };

  const openEditModal = (log) => {
    setCurrentLogToEdit(log);
    setEditQty(log.qty);
    setEditMeal(log.meal || defaultMeal(log.created_at));
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
    const newMeal = editMeal;
    const oldMeal = target.meal || defaultMeal(target.created_at);
    if (newQ === target.qty && newMeal === oldMeal) return; // nothing changed

    const ratio = newQ / target.qty;
    const patch = {
      ...(newMeal !== oldMeal ? { meal: newMeal } : {}),
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
            ? { ...l, qty: target.qty, calories: target.calories, protein: target.protein, carbs: target.carbs, fats: target.fats, fiber: target.fiber, meal: target.meal }
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


  // ── Streak (one rest day per week — lib/streak.js, same rule as Coach) ──────
  const todayKey = localDateKey();
  const streakInfo = useMemo(() => {
    const dates = new Set(loggedDates);
    if (logs.length) dates.add(todayKey); // live: first log of the day counts now
    const info = computeStreak([...dates], todayKey);
    const monday = weekOf(todayKey);
    const rest = new Set(info.restDays);
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${monday}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const day = d.toISOString().slice(0, 10);
      const state = dates.has(day) ? "logged" : rest.has(day) ? "rest" : day > todayKey ? "future" : "open";
      return { day, state };
    });
    return { ...info, week };
  }, [loggedDates, logs.length, todayKey]);

  // Food sheet "Add N items": log every pick under the chosen meal. Picks carry
  // per-serving macros; handleLocalAdd multiplies by qty. Foods found via the
  // packaged-food web search are also saved to custom foods (as before).
  const commitPicks = (entries, source = "sheet") => {
    entries.filter((e) => e.isWeb).forEach((e) => saveCustomFoodToDb({ name: e.name, ...e.per }));
    // One batch (one Undo), each entry filed under the meal it was picked for.
    // isWeb travels too: perUnitMacros must not swap a 0-kcal packaged food for a
    // name-alike from the built-in DB.
    handleLocalAdd(entries.map((e) => ({ name: e.name, qty: e.qty, ...e.per, meal: e.meal, isWeb: !!e.isWeb })), source);
  };

  // Log yesterday's meal again, filed under that meal, with its exact macros.
  const repeatMeal = (meal, items) =>
    logIdentifiedItems(
      items.map((i) => ({ name: i.name, qty: i.qty, calories: i.calories, protein: i.protein, carbs: i.carbs, fats: i.fats, fiber: i.fiber })),
      meal,
      "repeat",
    );

  const notifications = useNotifications();

  // ?water=1 (home-screen shortcut): add one glass once today's logs are in.
  useEffect(() => {
    // Wait for today's logs: adding before the first fetch lands would be
    // overwritten by that fetch's (older) snapshot.
    if (!waterFromUrl || waterHandledRef.current || !logsReady || !session) return;
    waterHandledRef.current = true;
    clearUrlAction();
    addFood("Water", null, null, "shortcut");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waterFromUrl, logsReady, session]);

  // ── Capture shortcuts (Phase 2) ─────────────────────────────────────────────
  const handleVoice = () => router.push("/voice");
  const handleSearchFocus = () => setLogSheet({ focus: true });
  // From a meal group's "+" (or the empty state): open the logger on that meal.
  const openLoggerForMeal = (meal) => {
    if (meal && MEALS.some((m) => m.label === meal)) setSelectedMeal(meal);
    setLogSheet({ focus: false });
  };
  const closeLogSheet = useCallback(() => {
    setLogSheet(null);
    setQuery("");
    // Opened from a nudge/shortcut (?log=…): drop the param so a reload
    // doesn't reopen the sheet. Keeps Next's history state intact.
    clearUrlAction();
  }, []);
  // Ask the server what foods are in the photo (optionally with a spoken/typed
  // correction). Does NOT log — fills the confirm sheet so the user decides.
  const runIdentify = async (img, correction) => {
    if (!session || !img) return;
    setSnapLoading(true);
    setSnapError("");
    try {
      const res = await fetch("/api/identify-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: img.base64,
          mimeType: img.mimeType,
          userId: session.user.id,
          accessToken: session.access_token,
          correction: correction || "",
          meal: selectedMeal || "",
          date: localDateKey(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        setSnapItems([]);
        setSnapError(data.error);
      } else if (data.isFood === false) {
        setSnapItems([]);
        setSnapError("That doesn't look like food. Try another photo, or describe your meal below.");
      } else if (Array.isArray(data.items) && data.items.length) {
        setSnapItems(data.items);
        setSnapError(
          data.unmatched?.length
            ? `Couldn't place: ${data.unmatched.join(", ")}. Edit below or describe it.`
            : "",
        );
      } else {
        setSnapItems([]);
        setSnapError(
          data.unmatched?.length
            ? `I saw ${data.unmatched.join(", ")} but couldn't match those. Describe your meal below to add it.`
            : "I couldn't identify the foods. Describe your meal below and I'll add it.",
        );
      }
    } catch {
      setSnapError("Something went wrong reading the photo. Please try again.");
    }
    setSnapLoading(false);
  };

  // Snap: guardrail + downscale, then identify IN PLACE (stay on this page).
  const handleSnap = async (file) => {
    setSaveError("");
    let img;
    try {
      img = await compressImage(file);
    } catch (err) {
      setSaveError(err?.message || "Could not use that photo.");
      return;
    }
    setSnapImage(img);
    setSnapItems([]);
    setSnapError("");
    setSnapCorrection("");
    setSnapOpen(true);
    runIdentify(img, "");
  };

  const submitSnapCorrection = () => {
    const c = snapCorrection.trim();
    if (!c || !snapImage || snapLoading) return;
    setSnapCorrection("");
    runIdentify(snapImage, c);
  };

  const confirmSnap = () => {
    if (!snapItems.length) return;
    logIdentifiedItems(snapItems);
    setSnapOpen(false);
    setSnapItems([]);
    setSnapImage(null);
    setSnapCorrection("");
    setSnapError("");
  };

  const closeSnap = () => {
    setSnapOpen(false);
    setSnapItems([]);
    setSnapImage(null);
    setSnapCorrection("");
    setSnapError("");
  };

  // Inline tweaks in the sheet before logging — scale macros with the quantity.
  const updateSnapQty = (idx, delta) => {
    setSnapItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const oldQty = Number(it.qty) || 1;
        const newQty = Math.max(0.25, Math.round((oldQty + delta) * 100) / 100);
        // Scale from the ORIGINAL per-unit macros, not the last rounded values,
        // so + / − round-trips don't compound rounding (protein 0.4 → 0 forever).
        const base = it._perUnit || {
          calories: (it.calories || 0) / oldQty,
          protein: (it.protein || 0) / oldQty,
          carbs: (it.carbs || 0) / oldQty,
          fats: (it.fats || 0) / oldQty,
          fiber: (it.fiber || 0) / oldQty,
        };
        const r1 = (n) => Math.round(n * 10) / 10;
        return {
          ...it,
          _perUnit: base,
          qty: newQty,
          calories: Math.round(base.calories * newQty),
          protein: r1(base.protein * newQty),
          carbs: r1(base.carbs * newQty),
          fats: r1(base.fats * newQty),
          fiber: r1(base.fiber * newQty),
        };
      }),
    );
  };
  const removeSnapItem = (idx) => setSnapItems((prev) => prev.filter((_, i) => i !== idx));

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
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--accent)", display: "grid", placeItems: "center" }}>
          <Flame size={28} color="var(--on-accent)" fill="var(--on-accent)" />
        </div>
        <Loader2 className="animate-spin" size={18} color="var(--text-muted)" />
      </div>
    );
  }

  if (!session) {
    return (
      <AuthScreen
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
      className="app-wrapper today-wrapper"
      style={{
        minHeight: "100vh",
        // Kill the .app-wrapper CSS *horizontal* padding (sections own their
        // own 20px sides) so the sticky header reaches the screen edges and
        // content isn't double-inset — but keep a real vertical gap so the
        // stacked cards breathe instead of sitting wall-to-wall.
        padding: 0,
        gap: 24,
        paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))",
        width: "100%",
        overflowX: "hidden",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* CREATE A CUSTOM FOOD — z above the food sheet (9000) it opens from */}
      {isManualEntryOpen && (
        <CustomFoodSheet
          food={manualFood}
          setFood={setManualFood}
          addNow={manualAddNow}
          setAddNow={setManualAddNow}
          meal={selectedMeal}
          onSubmit={handleManualAddSubmit}
          onClose={() => setIsManualEntryOpen(false)}
        />
      )}

      {/* FIRST-RUN ONBOARDING / GOAL SETTER */}
      {showOnboarding && (
        <OnboardingModal
          initialProfile={userProfile}
          username={username}
          onComplete={completeOnboarding}
        />
      )}

      {/* USERNAME & PASSWORD — after the first email-code sign-in */}
      {showPasswordSetup && (
        <AccountSetupSheet
          username={username}
          setUsername={setUsername}
          password={newPassword}
          setPassword={setNewPassword}
          onSave={handleUpdatePassword}
          onClose={() => setShowPasswordSetup(false)}
        />
      )}

      {/* EDIT AN ENTRY */}
      {isEditingLog && currentLogToEdit && (
        <EditLogSheet
          log={currentLogToEdit}
          qty={editQty}
          setQty={setEditQty}
          meal={editMeal}
          setMeal={setEditMeal}
          onSave={saveLogEdit}
          onDelete={() => {
            deleteLog(currentLogToEdit.id);
            setIsEditingLog(false);
            setCurrentLogToEdit(null);
          }}
          onClose={() => setIsEditingLog(false)}
        />
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

      {/* SAVED MEAL BUILDER — z above the food sheet (9000) it opens from */}
      {isCreatingMeal && (
        <MealBuilderSheet
          editing={!!editingMealId}
          name={newMealName}
          setName={setNewMealName}
          items={mealBuilderItems}
          foodDb={COMBINED_DB}
          query={mealBuilderQuery}
          setQuery={setMealBuilderQuery}
          suggestions={getBuilderSuggestions()}
          onAdd={(name) => {
            addItemToBuilder(name);
            setMealBuilderQuery("");
          }}
          onRemove={removeItemFromBuilder}
          onQty={(idx, q) => setMealBuilderItems(mealBuilderItems.map((it, i) => (i === idx ? { ...it, qty: q } : it)))}
          onSave={saveBuiltMeal}
          onClose={() => setIsCreatingMeal(false)}
        />
      )}

      {/* Today: one column on phones (items keep the order below via CSS
          order); two columns on desktop — main log left, nudges right. */}
      <div className="today-grid">
        <div className="today-col today-main">
          <div className="tw" style={{ order: 1 }}>
          {/* HEADER — date, greeting, streak (Direction A) */}
          <TodayHeader
            name={username}
            dayLabel={new Date(`${todayKey}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            streak={streakInfo.streak}
            restLeftThisWeek={streakInfo.restLeftThisWeek}
            week={streakInfo.week}
          />
          </div>
          <div className="tw" style={{ order: 2 }}>
          {saveError && (
            <div style={{ padding: "0 20px" }}>
              <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 14, background: "var(--danger-soft)", color: "var(--text)", fontSize: 14, lineHeight: 1.45 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ color: "var(--danger)", fontWeight: 600 }}>That didn’t save.</strong> Check your connection and try again.
                  <span style={{ display: "block", fontSize: 12, color: "var(--text-faint)", marginTop: 4, overflowWrap: "anywhere" }}>{saveError}</span>
                </span>
                <button onClick={() => setSaveError("")} aria-label="Dismiss" style={{ background: "none", border: "none", padding: 2, color: "var(--text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
                  ✕
                </button>
              </div>
            </div>
          )}
          </div>
          <div className="tw" style={{ order: 5 }}>
          {/* Hero: kcal left, macros. "Goal" opens the goal settings. */}
          <StatsBoard
            conditions={conditions}
            totals={totals}
            userProfile={userProfile}
            onEditGoal={() => {
              setIsSettingGoal(true);
              setSettingsTab("profile");
            }}
          />
          </div>
          <div className="tw" style={{ order: 6 }}>
          {/* Water + weight — right under the hero so a long food log never buries them */}
          <BodyTiles
            totals={totals}
            userProfile={userProfile}
            conditions={conditions}
            onAddWater={() => addFood("Water", null, null, "water")}
            weightInput={weightInput}
            setWeightInput={setWeightInput}
            onSaveWeight={handleLogWeight}
            savingWeight={isLoggingWeight}
          />
          </div>
          <div className="tw" style={{ order: 8 }}>
          {/* Capture: Add food (logger sheet) · Snap · Say */}
          <CaptureBar
            onSnap={handleSnap}
            onVoice={handleVoice}
            onSearch={handleSearchFocus}
          />
          </div>
          <div className="tw" style={{ order: 9 }}>
          {/* One-tap re-log of recent foods into the current meal */}
          <QuickAddRow
            recents={recents}
            foodDb={COMBINED_DB}
            selectedMeal={selectedMeal}
            onAdd={(name) =>
              addFood(
                name,
                1,
                COMBINED_DB[name.toLowerCase()] ? null : recentMacrosRef.current[name] || null,
                "quick_add",
              )
            }
            onMore={() => openLoggerForMeal()}
          />
          </div>
          <div className="tw" style={{ order: 10 }}>
          {/* TODAY'S LOG — the current meal always offers a way forward */}
          <Timeline
            logs={logs}
            loading={loading}
            totals={totals}
            openEditModal={openEditModal}
            deleteLog={deleteLog}
            onAddToMeal={openLoggerForMeal}
            currentMeal={defaultMeal()}
            yesterdayByMeal={yesterdayByMeal || {}}
            onRepeatMeal={repeatMeal}
          />
          </div>
        </div>
        <aside className="today-col today-aside" aria-label="Suggestions">
          <div className="tw" style={{ order: 3 }}>
          {/* First week: three clear next steps instead of an empty screen */}
          <FirstWeekGuide
            accountCreatedAt={session?.user?.created_at}
            todayKey={todayKey}
            hasGoal={!!userProfile.weight}
            hasLogged={logs.length > 0 || recents.length > 0}
            notifications={notifications}
            onLogFirst={() => openLoggerForMeal()}
            onSetGoal={() => {
              setIsSettingGoal(true);
              setSettingsTab("profile");
            }}
          />
          </div>
          <div className="tw" style={{ order: 4 }}>
          {/* Evening: the day wrap (from 7 pm, once something is logged) */}
          <DayWrap
            totals={totals}
            userProfile={userProfile}
            conditions={conditions}
            logs={logs}
            todayKey={todayKey}
            onAddLateSnack={() => openLoggerForMeal("Snacks")}
          />
          </div>
          <div className="tw" style={{ order: 7 }}>
          {/* The one Coach nudge (deterministic, dismissible for the day) */}
          <CoachNudge
            totals={totals}
            userProfile={userProfile}
            conditions={conditions}
            foodDb={COMBINED_DB}
            recents={recents}
            day={todayKey}
            currentMeal={selectedMeal}
            onAdd={(name) => addFood(name, 1, null, "nudge")}
          />
          </div>
          <div className="tw" style={{ order: 12 }}>
          {/* Daily goals — kept quiet in Direction A (wrapper paddingBottom clears the nav) */}
          <QuestsCard quests={quests} />
          </div>
          <div className="tw" style={{ order: 11 }}>
          {/* After the first log: get them onto the installed app (reminders) */}
          <InstallPrompt hasLogged={logs.length > 0 || recents.length > 0} todayKey={todayKey} />
          </div>
        </aside>
      </div>

      {/* Barcode scanner — opened from the food sheet's search row */}
      {scanOpen && (
        <BarcodeScanner
          meal={selectedMeal}
          onAdd={({ name, per }) => {
            setScanOpen(false);
            commitPicks([{ name, qty: 1, per, isWeb: true }], "barcode"); // also saved to custom foods
          }}
          onManual={(name) => {
            setScanOpen(false);
            setManualFood((prev) => ({ ...prev, name: name || "" }));
            setIsManualEntryOpen(true);
          }}
          onClose={() => setScanOpen(false)}
        />
      )}

      {/* Deep links from nudges / shortcuts */}
      {snapPrompt && (
        <SnapPromptSheet
          meal={selectedMeal}
          onPick={(file) => {
            setSnapPrompt(false);
            clearUrlAction();
            handleSnap(file);
          }}
          onClose={() => {
            setSnapPrompt(false);
            clearUrlAction();
          }}
        />
      )}
      {repeatPrompt && (
        <RepeatMealSheet
          meal={repeatPrompt}
          data={yesterdayByMeal ? yesterdayByMeal[repeatPrompt] || null : undefined}
          onConfirm={(items) => {
            repeatMeal(repeatPrompt, items);
            setRepeatPrompt(null);
            clearUrlAction();
          }}
          onPickInstead={() => {
            openLoggerForMeal(repeatPrompt);
            setRepeatPrompt(null);
          }}
          onClose={() => {
            setRepeatPrompt(null);
            clearUrlAction();
          }}
        />
      )}

      {/* FOOD LOGGER SHEET — the full search / categories / grid */}
      {logSheet && (
        <LogFoodSheet
          onClose={closeLogSheet}
          onCommit={(entries) => commitPicks(entries, "sheet")}
          onScan={() => setScanOpen(true)}
          autoFocusSearch={logSheet.focus}
          selectedMeal={selectedMeal}
          setSelectedMeal={setSelectedMeal}
          query={query}
          setQuery={setQuery}
          foodDb={COMBINED_DB}
          recents={recents}
          savedMeals={savedMeals}
          suggestions={smartRecommendations}
          webResults={webResults}
          isWebSearching={isWebSearching}
          userProfile={userProfile}
          conditions={conditions}
          openMealBuilder={openMealBuilder}
          deleteMeal={deleteMeal}
          onCustomFood={(name) => {
            setManualFood({ ...manualFood, name: name || "" });
            setIsManualEntryOpen(true);
          }}
        />
      )}

      {/* Phase 0/1/3: reward bursts, auto-save Undo toast, celebrations */}
      <RewardLayer
        floats={floats}
        onFloatDone={(id) => setFloats((f) => f.filter((x) => x.id !== id))}
        toast={toast}
        onUndo={undoLastAdd}
        celebration={celebration}
        onCelebrationDone={() => setCelebration(null)}
      />

      {/* Snap-a-plate: confirm what the photo shows, then log */}
      {snapOpen && (
        <SnapSheet
          image={snapImage}
          loading={snapLoading}
          items={snapItems}
          error={snapError}
          correction={snapCorrection}
          setCorrection={setSnapCorrection}
          onQty={updateSnapQty}
          onRemove={removeSnapItem}
          onRedo={submitSnapCorrection}
          onConfirm={confirmSnap}
          onClose={closeSnap}
          meal={selectedMeal || "meal"}
        />
      )}
    </div>
  );
}


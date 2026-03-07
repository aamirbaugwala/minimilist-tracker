"use client";
/**
 * app/hooks/useNutrition.js
 *
 * Owns all food-log state and DB operations for the main tracker page.
 * Extracts ~400 lines of fetch/save/edit logic out of page.js.
 *
 * Usage:
 *   const nutrition = useNutrition(session, COMBINED_DB);
 *
 *   nutrition.logs            – today's enriched logs
 *   nutrition.totals          – { calories, protein, carbs, fats, fiber, water }
 *   nutrition.loading         – initial load spinner
 *   nutrition.hasUnsavedChanges
 *   nutrition.isSaving
 *   nutrition.recents         – last 10 unique food names
 *   nutrition.streak
 *   nutrition.addFood(name, qty?, macros?)
 *   nutrition.deleteLog(id)
 *   nutrition.editLog(id, newQty)
 *   nutrition.saveChanges()
 *   nutrition.fetchData(isBackground?)
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

const EMPTY_TOTALS = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, water: 0 };

export function useNutrition(session, COMBINED_DB) {
  const [logs, setLogs]                       = useState([]);
  const [totals, setTotals]                   = useState(EMPTY_TOTALS);
  const [loading, setLoading]                 = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving]               = useState(false);
  const [recents, setRecents]                 = useState([]);
  const [streak, setStreak]                   = useState(0);

  // ── Re-calculate totals whenever logs change ───────────────────────────────
  useEffect(() => {
    const newTotals = logs.reduce((acc, log) => ({
      calories: acc.calories + (log.calories || 0),
      protein:  acc.protein  + (log.protein  || 0),
      carbs:    acc.carbs    + (log.carbs    || 0),
      fats:     acc.fats     + (log.fats     || 0),
      fiber:    acc.fiber    + (log.fiber    || 0),
      water:    log.name === "Water"
                  ? acc.water + (log.qty || 0) * 0.25
                  : acc.water,
    }), EMPTY_TOTALS);
    setTotals(newTotals);
  }, [logs]);

  // ── Enrich a raw DB log with fiber if missing ──────────────────────────────
  const enrichLog = useCallback((log) => {
    if (log.name === "Water") return { ...log, fiber: 0 };
    if (log.fiber && log.fiber > 0) return log;

    let dbItem = COMBINED_DB[log.name.toLowerCase()];
    if (!dbItem) {
      const key = Object.keys(COMBINED_DB).find((k) =>
        k.includes(log.name.toLowerCase())
      );
      if (key) dbItem = COMBINED_DB[key];
    }
    return dbItem?.fiber
      ? { ...log, fiber: Math.round(dbItem.fiber * log.qty) }
      : { ...log, fiber: 0 };
  }, [COMBINED_DB]);

  // ── Fetch today's logs from Supabase ──────────────────────────────────────
  const fetchData = useCallback(async (isBackground = false) => {
    if (!session) return;
    if (!isBackground) setLoading(true);

    const todayKey = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("date", todayKey)
      .order("created_at", { ascending: false });

    if (!error) {
      setLogs((data || []).map(enrichLog));
      setHasUnsavedChanges(false);
    }

    // Recent food names (for the "Recent" category chip list)
    const { data: history } = await supabase
      .from("food_logs")
      .select("name")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (history) {
      setRecents([...new Set(history.map((h) => h.name))]);
    }

    if (!isBackground) setLoading(false);
  }, [session, enrichLog]);

  // ── Calculate logging streak ───────────────────────────────────────────────
  const fetchStreak = useCallback(async () => {
    if (!session) return;

    const { data } = await supabase
      .from("food_logs")
      .select("date")
      .eq("user_id", session.user.id)
      .order("date", { ascending: false });

    if (!data || data.length === 0) { setStreak(0); return; }

    const uniqueDates = [...new Set(data.map((d) => d.date))];
    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
      setStreak(0);
      return;
    }

    let count = 1;
    let current = new Date(uniqueDates[0]);
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i]);
      if (Math.ceil(Math.abs(current - prev) / 86_400_000) === 1) {
        count++;
        current = prev;
      } else break;
    }
    setStreak(count);
  }, [session]);

  // ── Local add (optimistic, unsaved) ───────────────────────────────────────
  const addFoodLocally = useCallback((itemsToAdd) => {
    setHasUnsavedChanges(true);
    setLogs((currentLogs) => {
      let updated = [...currentLogs];

      itemsToAdd.forEach((newItem) => {
        const foodName = newItem.name;
        const quantity = Number(newItem.qty) || 1;

        // Base macro data: use explicit macros → COMBINED_DB → zeros
        let base = {
          calories: newItem.calories || 0,
          protein:  newItem.protein  || 0,
          carbs:    newItem.carbs    || 0,
          fats:     newItem.fats     || 0,
          fiber:    newItem.fiber    || 0,
        };
        if (foodName !== "Water" && base.calories === 0 && !newItem.isWeb) {
          let dbData = COMBINED_DB[foodName.toLowerCase()];
          if (!dbData) {
            const key = Object.keys(COMBINED_DB).find((k) =>
              k.includes(foodName.toLowerCase())
            );
            if (key) dbData = COMBINED_DB[key];
          }
          if (dbData) base = dbData;
        }

        const existingIdx = updated.findIndex((l) => l.name === foodName);
        if (existingIdx !== -1) {
          const existing = updated[existingIdx];
          const newQty = Number(existing.qty) + quantity;
          updated[existingIdx] = {
            ...existing,
            qty:      newQty,
            calories: Math.round(base.calories * newQty),
            protein:  Math.round(base.protein  * newQty),
            carbs:    Math.round(base.carbs    * newQty),
            fats:     Math.round(base.fats     * newQty),
            fiber:    Math.round(base.fiber    * newQty),
          };
        } else {
          updated = [
            {
              id:       Math.random(),
              name:     foodName,
              qty:      quantity,
              calories: Math.round(base.calories * quantity),
              protein:  Math.round(base.protein  * quantity),
              carbs:    Math.round(base.carbs    * quantity),
              fats:     Math.round(base.fats     * quantity),
              fiber:    Math.round(base.fiber    * quantity),
              date:     new Date().toISOString().slice(0, 10),
              user_id:  session?.user.id,
            },
            ...updated,
          ];
        }
      });

      return updated;
    });
  }, [COMBINED_DB, session]);

  // ── Public addFood convenience wrapper ────────────────────────────────────
  const addFood = useCallback((foodName, qty = 1, explicitMacros = null) => {
    addFoodLocally([{ name: foodName, qty, ...explicitMacros }]);
  }, [addFoodLocally]);

  const loadMeal = useCallback((meal) => {
    addFoodLocally(meal.items);
  }, [addFoodLocally]);

  // ── Delete (optimistic) ───────────────────────────────────────────────────
  const deleteLog = useCallback((id) => {
    setHasUnsavedChanges(true);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  // ── Edit qty (optimistic) ─────────────────────────────────────────────────
  const editLog = useCallback((logId, newQty) => {
    const qty = Number(newQty);
    if (qty <= 0) { deleteLog(logId); return; }

    setLogs((prevLogs) =>
      prevLogs.map((log) => {
        if (log.id !== logId) return log;
        const ratio = qty / log.qty;
        return {
          ...log,
          qty,
          calories: Math.round(log.calories * ratio),
          protein:  Math.round(log.protein  * ratio),
          carbs:    Math.round(log.carbs    * ratio),
          fats:     Math.round(log.fats     * ratio),
          fiber:    Math.round((log.fiber || 0) * ratio),
        };
      })
    );
    setHasUnsavedChanges(true);
  }, [deleteLog]);

  // ── Persist to Supabase (delete-insert pattern) ───────────────────────────
  const saveChanges = useCallback(async () => {
    if (!session) return;
    setIsSaving(true);
    const todayKey = new Date().toISOString().slice(0, 10);
    try {
      await supabase
        .from("food_logs")
        .delete()
        .eq("user_id", session.user.id)
        .eq("date", todayKey);

      // Strip client-only fields before inserting (omit id + created_at)
      const OMIT = new Set(["id", "created_at"]);
      const cleanLogs = logs.map((log) =>
        Object.fromEntries(
          Object.entries({ ...log, user_id: session.user.id, date: todayKey })
            .filter(([k]) => !OMIT.has(k))
        )
      );

      if (cleanLogs.length > 0) {
        await supabase.from("food_logs").insert(cleanLogs);
      }

      setHasUnsavedChanges(false);
      await fetchData(true); // background refresh to sync DB-generated IDs
    } catch {
      alert("Save failed — please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [session, logs, fetchData]);

  return {
    logs,
    totals,
    loading,
    hasUnsavedChanges,
    isSaving,
    recents,
    streak,
    fetchData,
    fetchStreak,
    addFood,
    loadMeal,
    deleteLog,
    editLog,
    saveChanges,
  };
}

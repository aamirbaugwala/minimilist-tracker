/**
 * app/lib/profileActions.js — profile writes shared by Home and the Me tab, so
 * both save goals/usernames identically. Return { ok, error } and leave all UI
 * (alerts, closing modals) to the caller.
 */

import { dayKey } from "./day";
import { isValidBirthDate, withAgeFromBirthday } from "./age";
import { supabase } from "../supabase";

/**
 * Upsert a user_profiles row. Writes `age` from `birth_date` so the stored age
 * is today's. If the birth_date column hasn't been added yet (docs/birth-date.sql),
 * retries without it so saving never breaks.
 */
export async function upsertProfile(row, options) {
  const clean = "birth_date" in row && !row.birth_date ? { ...row, birth_date: null } : row;
  const payload = withAgeFromBirthday(clean);
  let { error } = await supabase.from("user_profiles").upsert(payload, options);
  if (error && "birth_date" in payload && /birth_date/i.test(error.message || "")) {
    const rest = { ...payload };
    delete rest.birth_date;
    ({ error } = await supabase.from("user_profiles").upsert(rest, options));
  }
  return { error };
}

/** Save the goal/body profile and snapshot it into goal_history. */
export async function saveProfileGoal(userId, profile) {
  if (!profile.target_calories && (!profile.weight || !profile.height)) {
    return { ok: false, error: "Please fill info" };
  }
  if (profile.birth_date && !isValidBirthDate(profile.birth_date)) {
    return { ok: false, error: "Please check your birthday" };
  }
  const target = profile.target_calories ? Number(profile.target_calories) : null;
  const adjustment = Number(profile.calorie_adjustment ?? 0);
  const priority = profile.protein_priority || "balanced";

  const { error } = await upsertProfile({
    user_id: userId,
    ...profile,
    target_calories: target,
    calorie_adjustment: adjustment,
    protein_priority: priority,
    updated_at: new Date(),
  });
  if (error) return { ok: false, error: "Error saving goal" };

  // Snapshot the goal so past days retain their original targets
  await supabase.from("goal_history").insert({
    user_id: userId,
    goal: profile.goal,
    activity: profile.activity,
    calorie_adjustment: adjustment,
    protein_priority: priority,
    target_calories: target,
    effective_from: dayKey(), // the app's 4 am local day
  });

  return { ok: true };
}

/** Upsert just the username on the profile row. */
export async function saveUsername(userId, username) {
  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      { user_id: userId, username, updated_at: new Date() },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error(error);
    return { ok: false, error: "Error saving username." };
  }
  return { ok: true };
}

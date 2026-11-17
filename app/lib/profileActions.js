/**
 * app/lib/profileActions.js — profile writes shared by Home and the Me tab, so
 * both save goals/usernames identically. Return { ok, error } and leave all UI
 * (alerts, closing modals) to the caller.
 */

import { supabase } from "../supabase";

/** Save the goal/body profile and snapshot it into goal_history. */
export async function saveProfileGoal(userId, profile) {
  if (!profile.target_calories && (!profile.weight || !profile.height)) {
    return { ok: false, error: "Please fill info" };
  }
  const target = profile.target_calories ? Number(profile.target_calories) : null;
  const adjustment = Number(profile.calorie_adjustment ?? 0);
  const priority = profile.protein_priority || "balanced";

  const { error } = await supabase.from("user_profiles").upsert({
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
    effective_from: new Date().toISOString().slice(0, 10),
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

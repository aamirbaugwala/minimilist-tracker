/**
 * /api/weekly-report
 *
 * Generates a weekly AI nutrition insight for the requesting user and stores it
 * in the `weekly_insights` Supabase table.
 *
 * Called:
 *  - Manually from the NutriCoach UI ("Generate weekly report" button)
 *  - Can be hooked to a Vercel / Cloudflare cron (POST to this endpoint every Sunday)
 *
 * Requires Supabase table:
 *   CREATE TABLE weekly_insights (
 *     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *     week_start  date NOT NULL,
 *     insight     text NOT NULL,
 *     score       integer,          -- 0-100 adherence score
 *     created_at  timestamptz DEFAULT now()
 *   );
 *   ALTER TABLE weekly_insights ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "users see own insights" ON weekly_insights
 *     FOR ALL USING (auth.uid() = user_id);
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseForUser(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API Key missing" }, { status: 500 });

    const { userId, accessToken } = await req.json();
    if (!userId || !accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseForUser(accessToken);

    // ── 1. Compute week_start (last Monday) ──────────────────────────────────
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysBack);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    // Avoid generating a duplicate for the same week
    const { data: existing } = await db
      .from("weekly_insights")
      .select("id, insight, score")
      .eq("user_id", userId)
      .eq("week_start", weekStartStr)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ insight: existing.insight, score: existing.score, cached: true });
    }

    // ── 2. Fetch data ─────────────────────────────────────────────────────────
    const [{ data: logs }, { data: profile }, { data: weights }] = await Promise.all([
      db
        .from("food_logs")
        .select("date, name, calories, protein, carbs, fats, fiber")
        .eq("user_id", userId)
        .gte("date", weekStartStr)
        .order("date", { ascending: true }),
      db
        .from("user_profiles")
        .select("weight, height, age, gender, activity, goal, target_calories, username")
        .eq("user_id", userId)
        .single(),
      db
        .from("weight_logs")
        .select("date, weight")
        .eq("user_id", userId)
        .gte("date", weekStartStr)
        .order("date", { ascending: true }),
    ]);

    if (!profile) {
      return NextResponse.json({ error: "No profile found for user." }, { status: 400 });
    }

    // ── 3. Aggregate daily stats ──────────────────────────────────────────────
    const byDay = {};
    (logs || []).forEach((l) => {
      if (!byDay[l.date]) byDay[l.date] = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };
      byDay[l.date].calories += l.calories || 0;
      byDay[l.date].protein += l.protein || 0;
      byDay[l.date].carbs += l.carbs || 0;
      byDay[l.date].fats += l.fats || 0;
      byDay[l.date].fiber += l.fiber || 0;
    });

    const loggedDays = Object.keys(byDay).length;
    const avgCalories = loggedDays
      ? Math.round(Object.values(byDay).reduce((s, d) => s + d.calories, 0) / loggedDays)
      : 0;
    const avgProtein = loggedDays
      ? Math.round(Object.values(byDay).reduce((s, d) => s + d.protein, 0) / loggedDays)
      : 0;

    // Compute calorie target
    let targetCals = profile.target_calories ? Number(profile.target_calories) : (() => {
      const bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.gender === "male" ? 5 : -161);
      const mults = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
      const tdee = bmr * (mults[profile.activity] || 1.2);
      return Math.round(profile.goal === "lose" ? tdee - 500 : profile.goal === "gain" ? tdee + 300 : tdee);
    })();

    // Days within 15% of calorie target = "on target"
    const onTargetDays = Object.values(byDay).filter(
      (d) => Math.abs(d.calories - targetCals) / targetCals <= 0.15
    ).length;

    // Adherence score: consistency (40%) + on-target days (40%) + protein adequacy (20%)
    const w = Number(profile.weight);
    const targetP = profile.goal === "lose" ? Math.round(w * 2.2) : profile.goal === "gain" ? Math.round(w * 1.8) : Math.round(w * 1.6);
    const consistencyScore = Math.round((loggedDays / 7) * 40);
    const targetScore = Math.round((onTargetDays / Math.max(loggedDays, 1)) * 40);
    const proteinScore = Math.round(Math.min(avgProtein / targetP, 1) * 20);
    const adherenceScore = consistencyScore + targetScore + proteinScore;

    const weightChange =
      weights && weights.length >= 2
        ? Math.round((weights[weights.length - 1].weight - weights[0].weight) * 10) / 10
        : null;

    // ── 4. Call Gemini for the narrative insight ──────────────────────────────
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `You are NutriCoach, an AI nutrition coach. Write a short, motivating weekly insight report for this user.

User Profile:
- Name: ${profile.username || "User"}
- Goal: ${profile.goal} weight
- Activity: ${profile.activity}
- Calorie target: ${targetCals} kcal/day
- Protein target: ${targetP}g/day

This week's data (${weekStartStr} to today):
- Days with food logged: ${loggedDays}/7
- Average daily calories: ${avgCalories} kcal (target: ${targetCals})
- Average daily protein: ${avgProtein}g (target: ${targetP}g)
- Days within 15% of calorie target: ${onTargetDays}/${loggedDays}
- Adherence score: ${adherenceScore}/100
${weightChange !== null ? `- Weight change this week: ${weightChange > 0 ? "+" : ""}${weightChange} kg` : "- No weight data this week"}

Write 3-4 sentences max. Be specific — reference their actual numbers. Be warm but honest. End with one actionable tip for next week. Use 1-2 emojis.`;

    const result = await model.generateContent(prompt);
    const insight = result.response.text().trim();

    // ── 5. Store the insight ──────────────────────────────────────────────────
    await db.from("weekly_insights").insert({
      user_id: userId,
      week_start: weekStartStr,
      insight,
      score: adherenceScore,
    });

    return NextResponse.json({ insight, score: adherenceScore, weekStart: weekStartStr });
  } catch (error) {
    console.error("Weekly Report Error:", error);
    return NextResponse.json({ error: "Failed to generate report: " + error.message }, { status: 500 });
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordLlmUsage } from "../../lib/llmCost";

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
    if (!apiKey) {
      return NextResponse.json({ message: "API Key missing" }, { status: 500 });
    }

    const { userId, accessToken } = await req.json();

    if (!userId || !accessToken) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // ── Fetch data server-side (never trust client-sent logs) ─────────────────
    const db = getSupabaseForUser(accessToken);
    const lookbackDays = 30;
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);
    const sinceStr = since.toISOString().slice(0, 10);

    const [{ data: rawLogs }, { data: profile }, { data: weightLogs }] = await Promise.all([
      db.from("food_logs")
        .select("date, name, calories, protein, carbs, fats, fiber")
        .eq("user_id", userId)
        .gte("date", sinceStr)
        .order("date", { ascending: true }),
      db.from("user_profiles")
        .select("goal, weight, activity")
        .eq("user_id", userId)
        .single(),
      db.from("weight_logs")
        .select("date, weight")
        .eq("user_id", userId)
        .gte("date", sinceStr)
        .order("date", { ascending: true }),
    ]);

    // ── Pre-aggregate: daily totals + top foods (save ~70% tokens vs raw logs) ─
    const byDay = {};
    const foodFreq = {};
    (rawLogs || []).forEach((l) => {
      if (!byDay[l.date]) byDay[l.date] = { cal: 0, pro: 0, carb: 0, fat: 0 };
      byDay[l.date].cal  += l.calories || 0;
      byDay[l.date].pro  += l.protein  || 0;
      byDay[l.date].carb += l.carbs    || 0;
      byDay[l.date].fat  += l.fats     || 0;
      if (l.name !== "Water") foodFreq[l.name] = (foodFreq[l.name] || 0) + 1;
    });

    const loggedDays = Object.keys(byDay).length;
    const avgCal     = loggedDays ? Math.round(Object.values(byDay).reduce((s, d) => s + d.cal, 0) / loggedDays) : 0;
    const avgPro     = loggedDays ? Math.round(Object.values(byDay).reduce((s, d) => s + d.pro, 0) / loggedDays) : 0;

    const topFoods = Object.entries(foodFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => `${name} (×${count})`)
      .join(", ");

    // Daily calorie pattern — just the numbers, not raw objects
    const dailyCalPattern = Object.entries(byDay)
      .map(([date, d]) => `${date}: ${Math.round(d.cal)} kcal, ${Math.round(d.pro)}g protein`)
      .join("\n");

    const weightSummary = weightLogs && weightLogs.length >= 2
      ? `Weight: ${weightLogs[0].weight}kg → ${weightLogs[weightLogs.length - 1].weight}kg over ${lookbackDays} days`
      : weightLogs?.length === 1
      ? `Weight: ${weightLogs[0].weight}kg (single entry)`
      : "No weight data logged";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
Act as an elite nutrition coach analyzing a client's dietary data.

CLIENT:
- Goal: ${profile?.goal || "General Health"}
- Weight: ${profile?.weight || "Unknown"}kg
- Activity: ${profile?.activity || "Unknown"}

LAST ${lookbackDays} DAYS SUMMARY:
- Days with food logged: ${loggedDays}/${lookbackDays}
- Average daily calories: ${avgCal} kcal
- Average daily protein: ${avgPro}g
- Most eaten foods: ${topFoods || "None"}
- ${weightSummary}

DAILY CALORIE LOG:
${dailyCalPattern || "No data"}

OUTPUT FORMAT (max 200 words, use emojis):

📉 1. TREND ANALYSIS
Identify patterns: e.g., "You consistently eat less on weekends", "Your protein drops mid-week".

🛑 2. THE BIGGEST BLOCKER
The ONE thing stopping them from reaching their goal of ${profile?.goal}.

✅ 3. THE ACTION PLAN
Specific, simple food swaps or habits to fix the blocker starting tomorrow.
`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // Persist what this call cost. Awaited: serverless can freeze as soon as
    // the response returns, which would drop a fire-and-forget insert.
    await recordLlmUsage({
      userId,
      route: "coach",
      usageMetadata: result.response?.usageMetadata,
    });

    return NextResponse.json({ message: text });

  } catch (error) {
    console.error("AI Coach Error:", error);
    return NextResponse.json({
      message: "I can't connect to the AI right now. Please try again later."
    }, { status: 500 });
  }
}
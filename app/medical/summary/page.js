"use client";

/**
 * Doctor summary — one printable page a user can save as PDF and hand to their
 * doctor. Built only from the user's own data:
 *   • who: name, age, sex, height, weight, goal
 *   • markers to watch: latest vs previous value with direction, across reports
 *   • daily targets the app sets (and what the blood work changed)
 *   • the last 14 days: days logged and average intake vs target
 *   • foods the reports suggested eating more of / going easy on
 * Always a light "paper" look (both themes, screen and print). "Save as PDF"
 * uses the browser's print dialog, which saves or shares a real text PDF on
 * phones and desktops.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { supabase } from "../../supabase";
import { useAuth } from "../../hooks/useAuth";
import { calculateTargets, GOAL_PRESETS } from "../../lib/nutrition";
import { deriveConditions, conditionsFromProfile, mergeConditions } from "../../lib/conditions";
import { buildMarkerSeries } from "../../lib/markerSeries";
import { fmtDay, reportDay } from "../../lib/medicalUi";
import { dayKeyDaysAgo } from "../../lib/day";
import { profileAge } from "../../lib/age";

const DAYS = 14;
const PAPER = { bg: "#ffffff", text: "#16181d", muted: "#5b6070", faint: "#8a8f9c", line: "#e3e5ea", high: "#b42318", low: "#b54708", good: "#067647" };
const STATUS_WORD = { high: "High", low: "Low", borderline: "Borderline", normal: "Normal" };

const round = (n) => Math.round(Number(n) || 0);
const goalLabel = (p) =>
  GOAL_PRESETS.find((g) => g.calorie_adjustment === Number(p?.calorie_adjustment || 0) && g.protein_priority === (p?.protein_priority || "balanced"))?.label ||
  p?.goal ||
  "—";

export default function DoctorSummaryPage() {
  const router = useRouter();
  const { session, initializing } = useAuth();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    if (initializing) return;
    if (!session) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      const uid = session.user.id;
      const since = dayKeyDaysAgo(DAYS - 1);
      const [{ data: profile }, { data: reports }, { data: logs }] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("medical_reports").select("flags, report_date, created_at, include_foods, exclude_foods").eq("user_id", uid),
        supabase.from("food_logs").select("date, name, qty, calories, protein, carbs, fats, fiber").eq("user_id", uid).gte("date", since),
      ]);
      if (!cancelled) setState({ loading: false, profile: profile || {}, reports: reports || [], logs: logs || [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [initializing, session, router]);

  const view = useMemo(() => {
    if (state.loading) return null;
    const { profile, reports, logs } = state;
    const conditions = mergeConditions(deriveConditions(reports), conditionsFromProfile(profile));
    const targets = calculateTargets(profile, conditions);

    const series = buildMarkerSeries(reports);
    const watch = series
      .filter((m) => m.latest && (m.latest.status !== "normal" || m.trend.improving === true))
      .sort((a, b) => (a.latest.status === "normal") - (b.latest.status === "normal") || a.label.localeCompare(b.label));
    const normalCount = series.length - watch.length;

    const byDay = new Map();
    for (const l of logs) {
      const d = byDay.get(l.date) || { cals: 0, p: 0, c: 0, f: 0, fib: 0, water: 0 };
      if (l.name === "Water") d.water += (Number(l.qty) || 0) * 0.25;
      else {
        d.cals += Number(l.calories) || 0;
        d.p += Number(l.protein) || 0;
        d.c += Number(l.carbs) || 0;
        d.f += Number(l.fats) || 0;
        d.fib += Number(l.fiber) || 0;
      }
      byDay.set(l.date, d);
    }
    const foodDays = [...byDay.values()].filter((d) => d.cals > 0);
    const avg = (k) => (foodDays.length ? foodDays.reduce((s, d) => s + d[k], 0) / foodDays.length : 0);
    const waterDays = [...byDay.values()].filter((d) => d.water > 0);
    const avgWater = waterDays.length ? waterDays.reduce((s, d) => s + d.water, 0) / waterDays.length : 0;

    const sorted = [...reports].sort((a, b) => reportDay(b).localeCompare(reportDay(a)));
    const withFoods = sorted.find((r) => r.include_foods?.length || r.exclude_foods?.length);

    return { profile, targets, conditions, watch, normalCount, reportCount: reports.length, latestReport: sorted[0], foodDays: foodDays.length, avg, avgWater, withFoods };
  }, [state]);

  if (!view) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const { profile, targets, watch, normalCount, reportCount, latestReport, foodDays, avg, avgWater, withFoods } = view;
  const name = profile.username || session?.user?.email?.split("@")[0] || "—";
  const today = fmtDay(new Date().toISOString().slice(0, 10));
  const rows = [
    ["Calories", "kcal", targets.targetCals, avg("cals")],
    ["Protein", "g", targets.targetMacros.p, avg("p")],
    ["Carbohydrate", "g", targets.targetMacros.c, avg("c")],
    ["Fat", "g", targets.targetMacros.f, avg("f")],
    ["Fibre", "g", targets.targetMacros.fib, avg("fib")],
  ];

  return (
    <div className="doc-wrap">
      <style>{`
        .doc-wrap { min-height: 100vh; background: var(--bg); padding: 16px 16px 120px; }
        .doc-bar { max-width: 760px; margin: 0 auto 14px; display: flex; gap: 10px; align-items: center; }
        .doc { max-width: 760px; margin: 0 auto; background: ${PAPER.bg}; color: ${PAPER.text}; border-radius: 16px; padding: 28px 26px; font-size: 14px; line-height: 1.5; color-scheme: light; }
        .doc h1 { margin: 0; font-size: 22px; font-weight: 650; letter-spacing: -0.01em; }
        .doc h2 { margin: 26px 0 8px; font-size: 13px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.06em; color: ${PAPER.muted}; }
        .doc .muted { color: ${PAPER.muted}; }
        .doc .faint { color: ${PAPER.faint}; font-size: 12px; }
        .doc table { width: 100%; border-collapse: collapse; }
        .doc th, .doc td { text-align: left; padding: 7px 8px 7px 0; border-bottom: 1px solid ${PAPER.line}; vertical-align: top; }
        .doc th { font-size: 12px; font-weight: 600; color: ${PAPER.muted}; }
        .doc td.num, .doc th.num { text-align: right; padding-right: 0; padding-left: 8px; font-variant-numeric: tabular-nums; }
        .doc .facts { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 10px; }
        .doc ul { margin: 6px 0 0; padding-left: 18px; }
        .doc li { margin: 3px 0; }
        @media (max-width: 520px) { .doc { padding: 22px 16px; border-radius: 12px; } .doc .hide-sm { display: none; } }
        @media print {
          @page { margin: 14mm; }
          html, body { background: #fff !important; }
          .app-nav, .no-print { display: none !important; }
          .doc-wrap { padding: 0; background: #fff; }
          .doc { max-width: none; border-radius: 0; padding: 0; }
          .doc .hide-sm { display: table-cell !important; }
          .doc tr, .doc li { break-inside: avoid; }
        }
      `}</style>

      <div className="doc-bar no-print">
        <button onClick={() => router.back()} aria-label="Back" style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <ArrowLeft size={18} />
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Summary for your doctor</span>
        <button onClick={() => window.print()} style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "none", background: "var(--accent)", color: "var(--on-accent)", fontFamily: "inherit", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <Printer size={16} /> Save as PDF
        </button>
      </div>

      <article className="doc">
        <h1>Nutrition summary</h1>
        <div className="muted">Prepared {today} by NutriTrack from {name}&apos;s own reports and food logs.</div>
        <div className="facts">
          <span><strong>{name}</strong></span>
          {profileAge(profile) && <span>{profileAge(profile)} years</span>}
          {profile.gender && <span style={{ textTransform: "capitalize" }}>{profile.gender}</span>}
          {profile.height && <span>{round(profile.height)} cm</span>}
          {profile.weight && <span>{Number(profile.weight)} kg</span>}
          <span style={{ textTransform: "capitalize" }}>Goal: {goalLabel(profile)}</span>
          {profile.dietary_pattern && <span style={{ textTransform: "capitalize" }}>Diet: {profile.dietary_pattern}</span>}
          {profile.allergies?.length > 0 && <span>Allergies: {profile.allergies.join(", ")}</span>}
        </div>

        <h2>Markers to watch</h2>
        {reportCount === 0 ? (
          <p className="muted">No blood reports uploaded yet.</p>
        ) : watch.length === 0 ? (
          <p className="muted">All {normalCount} markers read from {reportCount} report{reportCount === 1 ? "" : "s"} were in range.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Marker</th>
                  <th>Latest</th>
                  <th className="hide-sm">Previous</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {watch.map((m) => (
                  <tr key={m.id}>
                    <td>{m.label}</td>
                    <td>
                      <span style={{ color: m.latest.status === "high" ? PAPER.high : m.latest.status === "normal" ? PAPER.text : PAPER.low, fontWeight: 600 }}>{m.latest.value}</span>{" "}
                      <span className="faint">
                        {STATUS_WORD[m.latest.status] || m.latest.status} · {fmtDay(m.latest.date)}
                      </span>
                    </td>
                    <td className="hide-sm">{m.previous ? <>{m.previous.value} <span className="faint">{fmtDay(m.previous.date)}</span></> : <span className="faint">—</span>}</td>
                    <td>
                      {m.trend.improving === true ? (
                        <span style={{ color: PAPER.good }}>Improving</span>
                      ) : m.trend.improving === false ? (
                        <span style={{ color: PAPER.high }}>Worse</span>
                      ) : m.previous ? (
                        <span className="faint">{m.trend.direction === "flat" ? "No change" : m.trend.direction === "up" ? "Up" : "Down"}</span>
                      ) : (
                        <span className="faint">First reading</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="faint" style={{ margin: "8px 0 0" }}>
              From {reportCount} report{reportCount === 1 ? "" : "s"}, latest {fmtDay(reportDay(latestReport))}. {normalCount > 0 && `${normalCount} other marker${normalCount === 1 ? " was" : "s were"} in range.`} Values are as read from the uploaded reports; please check against the originals.
            </p>
          </>
        )}

        <h2>Daily targets and the last {DAYS} days</h2>
        <table>
          <thead>
            <tr>
              <th>Per day</th>
              <th className="num">Target</th>
              <th className="num">Average eaten</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, unit, target, eaten]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="num">
                  {round(target)} {unit}
                </td>
                <td className="num">{foodDays ? `${round(eaten)} ${unit}` : "—"}</td>
              </tr>
            ))}
            <tr>
              <td>Water</td>
              <td className="num">{targets.waterTarget} L</td>
              <td className="num">{avgWater ? `${avgWater.toFixed(1)} L` : "—"}</td>
            </tr>
          </tbody>
        </table>
        <p className="faint" style={{ margin: "8px 0 0" }}>
          Food logged on {foodDays} of the last {DAYS} days{foodDays ? "; averages are over those days only" : ""}. Logged by the user, often from photos or voice, so amounts are estimates.
        </p>
        {targets.medical?.adjustments?.length > 0 && (
          <>
            <div style={{ marginTop: 12, fontWeight: 600 }}>Adjusted because of the blood work</div>
            <ul>
              {targets.medical.adjustments.map((a) => (
                <li key={a.title}>
                  {a.title}. <span className="muted">{a.detail}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {withFoods && (
          <>
            <h2>Food suggestions from the report</h2>
            <p className="faint" style={{ margin: "0 0 6px" }}>From the report dated {fmtDay(reportDay(withFoods))}.</p>
            {withFoods.include_foods?.length > 0 && (
              <>
                <div style={{ fontWeight: 600 }}>Eat more</div>
                <ul>
                  {withFoods.include_foods.map((f, i) => (
                    <li key={`i${i}`}>
                      {f.food}
                      {f.reason && <span className="muted">: {f.reason}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {withFoods.exclude_foods?.length > 0 && (
              <>
                <div style={{ fontWeight: 600, marginTop: 10 }}>Go easy on</div>
                <ul>
                  {withFoods.exclude_foods.map((f, i) => (
                    <li key={`e${i}`}>
                      {f.food}
                      {f.reason && <span className="muted">: {f.reason}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <p className="faint" style={{ marginTop: 28, paddingTop: 12, borderTop: `1px solid ${PAPER.line}` }}>
          Generated by NutriTrack, a food-tracking app that works alongside your doctor. It isn&apos;t a medical service. Report values are read automatically from uploaded files, and food suggestions are generated by AI; please confirm anything important against the original report.
        </p>
      </article>
    </div>
  );
}

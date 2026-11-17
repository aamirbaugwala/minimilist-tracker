"use client";

/**
 * Me — the one place for "about me & my account": profile/goals, medical
 * vault, reminders, username/password, log out. Replaces the old "More"
 * drawer and the settings gear on Home.
 *
 * Settings reuse the same SettingsModal and the same save logic as Home
 * (lib/profileActions), so editing a goal here and on Home behaves the same.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { useLocalStorageValue } from "../hooks/useLocalStorageValue";
import { THEME_KEY, applyTheme } from "../lib/theme";
import { supabase } from "../supabase";
import { useAuth } from "../hooks/useAuth";
import PageHeader from "../components/PageHeader";
import SettingsModal from "../components/SettingsModal";
import { calculateTargets, GOAL_PRESETS } from "../lib/nutrition";
import { deriveConditions, conditionsFromProfile, mergeConditions } from "../lib/conditions";
import { saveProfileGoal, saveUsername } from "../lib/profileActions";

export default function MePage() {
  const router = useRouter();
  const { session, initializing, signOut, updatePassword } = useAuth();

  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState({});
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [biomarkerConditions, setBiomarkerConditions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("profile");
  const [reports, setReports] = useState([]);
  const [remindersOn, setRemindersOn] = useState(null);
  const [themePref, setThemePref] = useLocalStorageValue(THEME_KEY);

  useEffect(() => {
    if (initializing) return;
    if (!session) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      const uid = session.user.id;
      const [{ data: profile }, { data: medical }] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("medical_reports").select("flags, report_date, created_at").eq("user_id", uid),
      ]);
      if (cancelled) return;
      if (profile) {
        setUserProfile(profile);
        setUsername(profile.username || "");
      }
      setBiomarkerConditions(deriveConditions(medical || []));
      setReports(medical || []);
      setLoading(false);

      supabase
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("active", true)
        .then(({ count }) => !cancelled && setRemindersOn(count ?? 0));

      // Admins get a shortcut to the portal; failure just hides the row.
      supabase
        .rpc("is_admin")
        .then(({ data }) => !cancelled && setIsAdmin(data === true))
        .catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [initializing, session, router]);

  const conditions = useMemo(
    () => mergeConditions(biomarkerConditions, conditionsFromProfile(userProfile)),
    [biomarkerConditions, userProfile],
  );
  const targets = useMemo(() => calculateTargets(userProfile, conditions), [userProfile, conditions]);
  const goalLabel = GOAL_PRESETS.find((g) => g.id === userProfile.goal)?.label;

  const openSettings = (tab) => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const saveGoal = async () => {
    const result = await saveProfileGoal(session.user.id, userProfile);
    if (!result.ok) return alert(result.error);
    setSettingsOpen(false);
  };

  const handleUpdatePassword = async () => {
    if (!newPassword && !username) return alert("Please enter a username or password.");
    let msg = "";
    if (newPassword) {
      const result = await updatePassword(newPassword);
      if (!result.ok) return alert(result.error);
      msg += "Password updated. ";
    }
    if (username) {
      const saved = await saveUsername(session.user.id, username);
      if (!saved.ok) return alert(saved.error);
      setUserProfile((prev) => ({ ...prev, username }));
      msg += "Username saved.";
    }
    alert(msg);
    setNewPassword("");
  };

  if (initializing || loading) {
    return (
      <div style={{ height: "100dvh", display: "grid", placeItems: "center", background: "var(--bg)" }}>
        <Loader2 size={24} color="var(--text-muted)" className="animate-spin" />
      </div>
    );
  }

  const name = userProfile.username || session?.user?.email?.split("@")[0] || "You";
  const lastReport = reports.map((r) => String(r.report_date || r.created_at || "").slice(0, 10)).filter(Boolean).sort().pop();
  const reportsHint = reports.length
    ? `${reports.length} report${reports.length === 1 ? "" : "s"} · last on ${new Date(`${lastReport}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : "Add a blood report for food advice";
  const pref = themePref || "system";

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--text)", width: "100%", boxSizing: "border-box", maxWidth: 640, margin: "0 auto", paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}>
      {/* Tab root: no back button */}
      <PageHeader title="Me" />
      <div style={{ padding: "8px 20px 0", display: "flex", flexDirection: "column", gap: 24 }}>
        <button onClick={() => openSettings("profile")} style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface)", color: "inherit", cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" }}>
          <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent-text)", display: "grid", placeItems: "center", fontSize: 21, fontWeight: 600, flexShrink: 0, textTransform: "uppercase" }}>
            {name.charAt(0)}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 18, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            <span style={{ display: "block", fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>
              {[goalLabel, userProfile.weight ? `${userProfile.weight} kg` : null, userProfile.weight ? `${Math.round(targets.cals).toLocaleString("en-IN")} kcal/day` : null].filter(Boolean).join(" · ") || "Set up your profile and goal"}
            </span>
          </span>
          <ChevronRight size={18} color="var(--text-faint)" />
        </button>

        <Group title="Health">
          <Row label="Profile & goals" hint="Body stats, goal, macro priorities" onClick={() => openSettings("profile")} />
          <Row label="Medical reports" hint={reportsHint} onClick={() => router.push("/medical")} />
        </Group>

        <Group title="App">
          <Row label="Reminders" hint={remindersOn === null ? "Meal, water and streak nudges" : remindersOn ? `${remindersOn} on` : "All off"} onClick={() => router.push("/notifications")} />
          <div className="me-row" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ flex: 1, fontSize: 15, minWidth: 100 }}>Appearance</span>
            <div role="radiogroup" aria-label="Appearance" style={{ display: "flex", padding: 3, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--border)" }}>
              {[
                ["system", "System"],
                ["dark", "Dark"],
                ["light", "Light"],
              ].map(([id, l]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={pref === id}
                  onClick={() => {
                    setThemePref(id);
                    applyTheme(id);
                  }}
                  style={{ padding: "6px 12px", border: "none", borderRadius: 9, background: pref === id ? "var(--surface-highlight)" : "none", color: pref === id ? "var(--text)" : "var(--text-muted)", fontFamily: "inherit", fontSize: 13, fontWeight: pref === id ? 600 : 400, cursor: "pointer" }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          {isAdmin && <Row label="Admin portal" hint="Traffic and AI cost" onClick={() => router.push("/admin")} />}
        </Group>

        <Group title="Account">
          <Row label="Username & password" hint={session?.user?.email} onClick={() => openSettings("security")} />
          <Row
            label="Log out"
            danger
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
          />
        </Group>
      </div>

      {settingsOpen && (
        <SettingsModal
          conditions={conditions}
          setIsSettingGoal={setSettingsOpen}
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
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section>
      <h2 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>{title}</h2>
      <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>{children}</div>
    </section>
  );
}

function Row({ label, hint, onClick, danger }) {
  return (
    <button className="me-row" onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", border: "none", background: "transparent", color: danger ? "var(--danger)" : "var(--text)", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: danger ? 600 : 400 }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hint}</span>}
      </span>
      {!danger && <ChevronRight size={16} color="var(--text-faint)" />}
    </button>
  );
}

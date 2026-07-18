"use client";
/**
 * app/hooks/useAuth.js
 *
 * Centralises all Supabase auth concerns:
 *   - session state
 *   - onAuthStateChange subscription (auto-cleanup on unmount)
 *   - signIn helpers (OTP + password)
 *   - signOut
 *
 * Usage:
 *   const { session, authLoading, sendOtp, verifyOtp, signInWithPassword, signOut } = useAuth();
 */

import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export function useAuth() {
  const [session, setSession]       = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]   = useState("");
  // Distinct from authLoading (which drives the form submit spinners): this
  // covers only the one-time "are we already signed in?" check on mount, so the
  // app can show a splash instead of flashing the landing page at returning
  // users while getSession() reads storage / refreshes an expired token.
  const [initializing, setInitializing] = useState(true);

  // ── Bootstrap: read current session + subscribe to changes ────────────────
  useEffect(() => {
    let mounted = true;

    // Initial session check
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setInitializing(false);
      })
      .catch(() => {
        // Never strand the user on the splash if the check fails.
        if (mounted) setInitializing(false);
      });

    // Live subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setInitializing(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── OTP (magic link / phone) ───────────────────────────────────────────────
  const sendOtp = async (email) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      setAuthError(err.message);
      return { ok: false, error: err.message };
    } finally {
      setAuthLoading(false);
    }
  };

  const verifyOtp = async (email, token) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      setAuthError(err.message);
      return { ok: false, error: err.message };
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Password login ─────────────────────────────────────────────────────────
  const signInWithPassword = async (email, password) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      setAuthError(err.message);
      return { ok: false, error: err.message };
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Google OAuth ───────────────────────────────────────────────────────────
  // Implicit flow (auth-js default): Supabase redirects back with the session in
  // the URL fragment, which the browser client picks up via detectSessionInUrl
  // and pushes through the onAuthStateChange subscription above — so there's no
  // /auth/callback route to maintain.
  const signInWithGoogle = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        // Return to whichever origin we started from (localhost / preview / prod)
        // rather than always the dashboard's Site URL.
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // No finally-reset on success: the browser navigates away to Google, so we
      // deliberately leave authLoading true to keep the button disabled.
      return { ok: true };
    } catch (err) {
      setAuthError(err.message);
      setAuthLoading(false);
      return { ok: false, error: err.message };
    }
  };

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // ── Update password / username ─────────────────────────────────────────────
  const updatePassword = async (newPassword) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      setAuthError(err.message);
      return { ok: false, error: err.message };
    } finally {
      setAuthLoading(false);
    }
  };

  return {
    session,
    initializing,
    authLoading,
    authError,
    setAuthError,
    sendOtp,
    verifyOtp,
    signInWithPassword,
    signInWithGoogle,
    signOut,
    updatePassword,
  };
}

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

  // ── Bootstrap: read current session + subscribe to changes ────────────────
  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Live subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
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
    authLoading,
    authError,
    setAuthError,
    sendOtp,
    verifyOtp,
    signInWithPassword,
    signOut,
    updatePassword,
  };
}

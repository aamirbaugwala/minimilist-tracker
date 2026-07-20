/**
 * POST /api/track/identify — stitch an anonymous visitor to a signed-in user.
 *
 * This is the endpoint that makes the whole thing worth building. Without it we
 * know "someone visited" and "someone signed up" but never that they were the
 * same person, so acquisition source can never be tied to retention.
 *
 * Two things happen:
 *   1. visitor_identities records the link (idempotent).
 *   2. page_views rows for that visitor are backfilled with the user_id, so the
 *      visits made BEFORE signup become attributable.
 *
 * The user_id is taken from a verified access token, never from the request
 * body — otherwise any caller could attribute traffic to an arbitrary user.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req) {
  try {
    const { visitorId, accessToken } = (await req.json().catch(() => ({}))) || {};

    if (!UUID_RE.test(visitorId || "") || !accessToken) {
      return new NextResponse(null, { status: 204 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !service) return new NextResponse(null, { status: 204 });

    // Verify the token server-side. This is the only trustworthy source of the
    // user's identity.
    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authErr,
    } = await asUser.auth.getUser();
    if (authErr || !user) return new NextResponse(null, { status: 204 });

    const db = createClient(url, service, { auth: { persistSession: false } });

    // When did this visitor first appear? Recorded on the link so we can measure
    // how long someone lurked before converting.
    const { data: firstView } = await db
      .from("page_views")
      .select("created_at")
      .eq("visitor_id", visitorId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    await db.from("visitor_identities").upsert(
      {
        visitor_id: visitorId,
        user_id: user.id,
        first_seen_at: firstView?.created_at ?? null,
      },
      { onConflict: "visitor_id,user_id" },
    );

    // Backfill this visitor's anonymous history. Scoped to rows that are still
    // unattributed so a shared device can't reassign another user's pageviews.
    await db
      .from("page_views")
      .update({ user_id: user.id })
      .eq("visitor_id", visitorId)
      .is("user_id", null);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[track/identify] failed:", err?.message);
    return new NextResponse(null, { status: 204 });
  }
}

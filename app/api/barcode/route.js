/**
 * GET /api/barcode?code=8901234567890
 *
 * Looks a packaged food up on Open Food Facts (free, open database) and returns
 * a normalised product: name, brand, pack size, serving size and per-100 g
 * nutrition. Server-side so we can send the descriptive User-Agent OFF asks
 * for (generic app name only — no user details) and cache results.
 */

import { NextResponse } from "next/server";

const UA = "NutriTrack/1.0 (nutrition tracking app)";
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function GET(req) {
  const code = new URL(req.url).searchParams.get("code")?.replace(/\D/g, "") || "";
  if (code.length < 8 || code.length > 14) {
    return NextResponse.json({ error: "That doesn’t look like a barcode (8–14 digits)." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_en,generic_name,brands,quantity,serving_size,serving_quantity,nutriments`,
      { headers: { "User-Agent": UA, Accept: "application/json" }, next: { revalidate: 86400 } },
    );
    if (res.status === 404) return NextResponse.json({ found: false, code });
    if (!res.ok) return NextResponse.json({ error: "Food database is busy. Try again in a moment." }, { status: 502 });
    const data = await res.json();
    const p = data?.product;
    if (!data?.status || !p) return NextResponse.json({ found: false, code });

    const n = p.nutriments || {};
    const kcal = n["energy-kcal_100g"] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
    const name = (p.product_name_en || p.product_name || p.generic_name || "").trim();
    if (!name || kcal == null) return NextResponse.json({ found: false, code, partial: !!name });

    return NextResponse.json(
      {
        found: true,
        code,
        name,
        brand: String(p.brands || "").split(",")[0].trim(),
        quantity: String(p.quantity || "").replace(/\s*[e℮]\s*$/i, "").trim(),
        servingGrams: num(p.serving_quantity) > 0 && num(p.serving_quantity) <= 1000 ? Math.round(num(p.serving_quantity)) : null,
        per100: {
          calories: Math.round(num(kcal)),
          protein: num(n.proteins_100g),
          carbs: num(n.carbohydrates_100g),
          fats: num(n.fat_100g),
          fiber: num(n.fiber_100g),
        },
      },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  } catch {
    return NextResponse.json({ error: "Couldn’t reach the food database. Check your connection." }, { status: 502 });
  }
}

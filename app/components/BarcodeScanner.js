"use client";

/**
 * Barcode scanner (Direction A) — opened from the food sheet's search row.
 *
 *   scanning → camera with a guide frame. Uses the browser's BarcodeDetector
 *              where it exists (Chrome on Android); otherwise loads ZXing on
 *              demand (iPhone, desktop). "Type the numbers" works everywhere,
 *              including without camera access.
 *   found    → product from Open Food Facts, pick a portion, "Add to <meal>".
 *   missing  → not in the database: scan again or enter it manually.
 *
 * Adding logs ONE entry named "<brand> <product> (<g> g)" with the macros for
 * that portion; the parent also saves it to custom foods so it shows up in
 * search and Recent next time.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { primaryBtn, secondaryBtn, sheetInput } from "./Sheet";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const r1 = (n) => Math.round(n * 10) / 10;

function portionMacros(per100, grams) {
  const f = grams / 100;
  return {
    calories: Math.round(per100.calories * f),
    protein: r1(per100.protein * f),
    carbs: r1(per100.carbs * f),
    fats: r1(per100.fats * f),
    fiber: r1(per100.fiber * f),
  };
}

export default function BarcodeScanner({ meal, onAdd, onManual, onClose }) {
  const videoRef = useRef(null);
  const stopRef = useRef(() => {});
  const [phase, setPhase] = useState("scanning"); // scanning | looking | found | missing | error
  const [cameraError, setCameraError] = useState("");
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [product, setProduct] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [grams, setGrams] = useState(null);
  const [custom, setCustom] = useState("");

  const lookup = async (raw) => {
    const c = String(raw).replace(/\D/g, "");
    stopRef.current();
    setCode(c);
    setPhase("looking");
    setError("");
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(c)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setPhase("error");
      } else if (!data.found) {
        setPhase("missing");
      } else {
        setProduct(data);
        setGrams(data.servingGrams || 100);
        setPhase("found");
      }
    } catch {
      setError("Couldn’t reach the food database. Check your connection.");
      setPhase("error");
    }
  };
  const lookupRef = useRef(lookup);
  useEffect(() => {
    lookupRef.current = lookup;
  });

  // Camera + detection while scanning.
  useEffect(() => {
    if (phase !== "scanning" || typing) return;
    let cancelled = false;
    let stream = null;
    let raf = 0;
    let zxingControls = null;
    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      try {
        zxingControls?.stop();
      } catch {
        /* already stopped */
      }
      stream?.getTracks().forEach((t) => t.stop());
    };
    stopRef.current = stop;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        setCameraError("The camera needs the app opened over https. Type the numbers under the barcode instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        setCameraError(e?.name === "NotAllowedError" ? "Camera access is blocked. Allow it in your browser settings, or type the numbers instead." : "Couldn’t open the camera. Type the numbers instead.");
        return;
      }
      if (cancelled) return stream.getTracks().forEach((t) => t.stop());
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});

      let native = null;
      try {
        if ("BarcodeDetector" in window) {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          const formats = FORMATS.filter((f) => supported.includes(f));
          if (formats.length) native = new window.BarcodeDetector({ formats });
        }
      } catch {
        native = null;
      }

      if (native) {
        const tick = async () => {
          if (cancelled) return;
          try {
            const hits = await native.detect(video);
            if (hits[0]?.rawValue) return lookupRef.current(hits[0].rawValue);
          } catch {
            /* frame not ready */
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } else {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        zxingControls = await reader.decodeFromVideoElement(video, (result) => {
          if (result && !cancelled) lookupRef.current(result.getText());
        });
        if (cancelled) zxingControls.stop();
      }
    })();

    return stop;
  }, [phase, typing]);

  // Esc closes the scanner only — capture + stopPropagation so the food sheet
  // underneath (also listening on window) doesn't close/ask to discard too.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const g = grams === "custom" ? Number(custom) || 0 : grams;
  const macros = product && g > 0 ? portionMacros(product.per100, g) : null;
  const restart = () => {
    setProduct(null);
    setTyped("");
    setTyping(false);
    setCameraError("");
    setPhase("scanning");
  };
  const showTyping = typing || !!cameraError;

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan a barcode" style={{ position: "fixed", inset: 0, zIndex: 10002, background: "#000", color: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Camera */}
      <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {phase === "scanning" && !showTyping && (
          <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <button onClick={onClose} aria-label="Close scanner" style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top, 0px))", right: 16, width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.5)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", zIndex: 2 }}>
          <X size={20} />
        </button>
        {phase === "scanning" && !showTyping && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, pointerEvents: "none" }}>
            <div style={{ width: "min(78vw, 320px)", height: 150, borderRadius: 18, border: "2px solid rgba(255,255,255,0.9)", boxShadow: "0 0 0 100vmax rgba(0,0,0,0.45)" }} />
            <div style={{ fontSize: 16, fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>Point at the barcode on the pack</div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div style={{ background: "var(--sheet)", color: "var(--text)", borderRadius: "22px 22px 0 0", padding: "18px 20px calc(18px + env(safe-area-inset-bottom, 0px))", maxHeight: "70dvh", overflowY: "auto" }}>
        {phase === "scanning" &&
          (showTyping ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (typed.replace(/\D/g, "").length >= 8) lookup(typed);
              }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              {cameraError && <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>{cameraError}</p>}
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                Numbers under the barcode
                <input inputMode="numeric" autoComplete="off" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="8901234567890" style={{ ...sheetInput, fontSize: 18, letterSpacing: 2 }} />
              </label>
              <button type="submit" disabled={typed.replace(/\D/g, "").length < 8} style={{ ...primaryBtn, opacity: typed.replace(/\D/g, "").length < 8 ? 0.5 : 1 }}>Look it up</button>
              {!cameraError && (
                <button type="button" onClick={() => setTyping(false)} style={{ ...secondaryBtn }}>Use the camera</button>
              )}
            </form>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>Works with many packaged foods — Indian brands too</div>
              <button onClick={() => setTyping(true)} style={secondaryBtn}>Type the numbers instead</button>
            </div>
          ))}

        {phase === "looking" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, fontSize: 15, color: "var(--text-muted)" }}>
            <Loader2 size={18} className="animate-spin" /> Looking up {code}…
          </div>
        )}

        {phase === "found" && product && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-text)" }}>Found it</div>
              <div style={{ fontSize: 19, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>{product.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                {[product.brand, product.quantity && `${product.quantity} pack`, "from Open Food Facts"].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div role="radiogroup" aria-label="Portion" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[...new Set([product.servingGrams, 100].filter(Boolean))].map((v) => (
                <button key={v} role="radio" aria-checked={grams === v} onClick={() => setGrams(v)} style={{ padding: "8px 14px", borderRadius: 99, border: grams === v ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: grams === v ? "var(--accent-soft)" : "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 14, fontWeight: grams === v ? 600 : 400, cursor: "pointer" }}>
                  {v} g{v === product.servingGrams ? " · 1 serving" : ""}
                </button>
              ))}
              <button role="radio" aria-checked={grams === "custom"} onClick={() => setGrams("custom")} style={{ padding: "8px 14px", borderRadius: 99, border: grams === "custom" ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: grams === "custom" ? "var(--accent-soft)" : "transparent", color: "var(--text)", fontFamily: "inherit", fontSize: 14, fontWeight: grams === "custom" ? 600 : 400, cursor: "pointer" }}>
                Custom
              </button>
            </div>
            {grams === "custom" && (
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--text-muted)" }}>
                <input inputMode="decimal" autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="45" aria-label="Grams" style={{ ...sheetInput, width: 110 }} /> grams
              </label>
            )}
            {macros && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, padding: "12px 4px", borderRadius: 14, background: "var(--surface)", textAlign: "center" }}>
                {[
                  [macros.calories, "kcal"],
                  [`${Math.round(macros.protein)} g`, "protein"],
                  [`${Math.round(macros.carbs)} g`, "carbs"],
                  [`${Math.round(macros.fats)} g`, "fat"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{v}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            )}
            <button
              disabled={!macros}
              onClick={() => onAdd({ name: `${product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? `${product.brand} ` : ""}${product.name} (${g} g)`, per: macros })}
              style={{ ...primaryBtn, opacity: macros ? 1 : 0.5 }}
            >
              Add to {meal}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={restart} style={{ background: "none", border: "none", padding: 6, color: "var(--text-muted)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>Scan another</button>
              <button onClick={() => onManual(product.name)} style={{ background: "none", border: "none", padding: 6, color: "var(--accent-text)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>Not right? Enter it manually</button>
            </div>
          </div>
        )}

        {(phase === "missing" || phase === "error") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{phase === "missing" ? "Not in the food database yet" : "Couldn’t look that up"}</div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {phase === "missing" ? `Barcode ${code} isn’t on Open Food Facts. Copy the numbers from the label once and it’ll be in your foods from then on.` : error}
            </p>
            <button onClick={() => onManual("")} style={primaryBtn}>Enter it manually</button>
            <button onClick={restart} style={secondaryBtn}>Scan again</button>
          </div>
        )}
      </div>
    </div>
  );
}

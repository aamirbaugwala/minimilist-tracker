// Client-side image guardrails + downscaling.
//
// Why this exists: gallery photos from modern phones are often 5–15 MB and
// 4000px wide. Sending those raw blows past sessionStorage limits (the Snap
// hand-off), bloats the request to the vision model, and is slow. This helper
// is the single guardrail every "pick an image" flow runs through:
//   • rejects anything that isn't actually an image
//   • rejects absurdly large source files before we even decode them
//   • re-encodes to a capped-dimension JPEG (also strips EXIF/location data)
//
// It runs only in the browser (uses <canvas>), so import it from client code.

const MAX_SOURCE_BYTES = 25 * 1024 * 1024; // guard before decoding into memory

export async function compressImage(file, { maxDim = 1280, quality = 0.82 } = {}) {
  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("That doesn't look like an image — please choose a photo.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("That image is too large. Please choose one under 25 MB.");
  }

  const sourceUrl = await readAsDataUrl(file);
  const img = await loadImage(sourceUrl);

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");
  ctx.drawImage(img, 0, 0, width, height);

  // JPEG: small and universally understood by the vision model.
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.replace("data:", "").replace(";base64", "");
  return { dataUrl, base64, mimeType, width, height };
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not open that image."));
    img.src = src;
  });
}

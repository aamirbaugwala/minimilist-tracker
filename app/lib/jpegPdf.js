/**
 * Build a minimal PDF from JPEG pages — one image per page, no dependencies.
 * Used to store a photographed blood report in the vault as ONE PDF, so the
 * "Original PDF" link works the same for photos and real PDFs.
 *
 * JPEGs embed as-is (DCTDecode), so there is no re-encoding and no quality
 * loss. Pages are 595 pt wide (A4 width) with the photo's aspect ratio.
 */

const enc = new TextEncoder();

/** Width/height from a JPEG's SOF marker, or null if it isn't a JPEG. */
export function jpegSize(bytes) {
  if (!bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    // Fill bytes / standalone markers carry no length.
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width && height ? { width, height } : null;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

/**
 * @param {Uint8Array[]} jpegs page images, in order
 * @returns {Uint8Array} PDF bytes
 */
export function jpegsToPdf(jpegs) {
  const pages = jpegs.map((bytes) => {
    const size = jpegSize(bytes);
    if (!size) throw new Error("Not a JPEG");
    return { bytes, ...size };
  });
  if (!pages.length) throw new Error("No pages");

  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (part) => {
    const b = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(b);
    length += b.length;
  };
  const obj = (n, body) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    body();
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  // Object numbers: 1 catalog, 2 pages, then per page: page, image, content.
  const pageObj = (k) => 3 + k * 3;
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, k) => `${pageObj(k)} 0 R`).join(" ")}] >>`));

  pages.forEach((p, k) => {
    const w = 595;
    const h = Math.round((595 * p.height) / p.width);
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    obj(pageObj(k), () =>
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${pageObj(k) + 1} 0 R >> >> /Contents ${pageObj(k) + 2} 0 R >>`),
    );
    obj(pageObj(k) + 1, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);
      push(p.bytes);
      push("\nendstream");
    });
    obj(pageObj(k) + 2, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  });

  const total = 3 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

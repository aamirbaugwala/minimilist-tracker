"use client";

/**
 * CoachMarkdown — how Coach's replies render (Direction A).
 *
 * Real Markdown (GFM) instead of the old bold-and-bullets parser, so headings,
 * numbered/nested lists, links, code, quotes, checklists and TABLES all look
 * right. Tables get special care because week plans arrive as tables:
 *   • wide tables (4+ columns, e.g. Day | Breakfast | Lunch | Snacks | Dinner)
 *     turn into one card per row on phone-width chats, and a scrollable table
 *     with a frozen first column when there's room (container query);
 *   • numbers right-align, a "Total" row is emphasised;
 *   • "Copy" puts a clean, readable version on the clipboard (WhatsApp, Notes).
 * Safety: no raw HTML, no remote images, links only http(s)/mailto and open in
 * a new tab. Works while streaming (it simply re-renders as text arrives).
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

// hast → plain text
const textOf = (node) => (node?.type === "text" ? node.value : (node?.children || []).map(textOf).join(""));
const rowsOf = (node) => {
  const out = [];
  const walk = (n) => {
    if (n?.tagName === "tr") out.push((n.children || []).filter((c) => c.tagName === "th" || c.tagName === "td").map((c) => textOf(c).trim()));
    else (n?.children || []).forEach(walk);
  };
  walk(node);
  return out;
};
const NUMERIC = /^[~≈]?\s*[\d.,]+\s*(kcal|cal|g|mg|kg|l|ml|%|x|×)?$/i;

function CopyButton({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <button type="button" onClick={copy} className="coach-md-copy" aria-label={done ? "Copied" : `${label} table`}>
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? "Copied" : label}
    </button>
  );
}

function Table({ node }) {
  const rows = rowsOf(node).filter((r) => r.some(Boolean));
  if (!rows.length) return null;
  const [head, ...body] = rows;
  const cols = head.length;
  const wide = cols >= 4;
  const isTotal = (r) => /^\s*(\*\*)?\s*(total|daily total|sum|average|avg)\b/i.test(r[0] || "");
  const dataRows = body.filter((r) => !isTotal(r)).length;
  // A column whose filled cells are all numbers right-aligns, header included.
  const numCol = head.map((_, ci) => ci > 0 && body.some((r) => r[ci]) && body.every((r) => !r[ci] || NUMERIC.test(r[ci].replace(/\*/g, ""))));
  // Readable plain text: "Mon — Breakfast: poha · Lunch: dal, 2 roti …"
  const plain = body
    .map((r) =>
      `${r[0]} — ${head
        .slice(1)
        .map((h, i) => (r[i + 1] ? `${h}: ${r[i + 1]}` : ""))
        .filter(Boolean)
        .join(" · ")}`,
    )
    .join("\n");

  return (
    <div className={`coach-md-table${wide ? " wide" : ""}`}>
      <div className="coach-md-table-bar">
        <span>{dataRows} {dataRows === 1 ? "row" : "rows"}</span>
        <CopyButton text={plain} />
      </div>

      {/* Table view */}
      <div className="coach-md-scroll" role="region" aria-label="Table" tabIndex={0}>
        <table>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} scope="col" className={numCol[i] ? "num" : undefined}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri} className={isTotal(r) ? "total" : undefined}>
                {head.map((_, ci) =>
                  ci === 0 ? (
                    <th key={ci} scope="row">{r[ci] || ""}</th>
                  ) : (
                    <td key={ci} className={numCol[ci] || NUMERIC.test(r[ci] || "") ? "num" : undefined}>{r[ci] || (isTotal(r) ? "" : "—")}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card view (narrow chats, wide tables only) */}
      {wide && (
        <div className="coach-md-cards">
          {body.map((r, ri) => (
            <div key={ri} className={`coach-md-card${isTotal(r) ? " total" : ""}`}>
              <div className="coach-md-card-title">{r[0]}</div>
              {head.slice(1).map((h, i) =>
                r[i + 1] ? (
                  <div key={i} className="coach-md-card-line">
                    <span>{h}</span>
                    <span>{r[i + 1]}</span>
                  </div>
                ) : null,
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const safeHref = (href = "") => (/^(https?:|mailto:)/i.test(href) ? href : null);

const components = {
  table: Table,
  a: ({ href, children }) => {
    const url = safeHref(href);
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    );
  },
  img: ({ alt }) => (alt ? <span className="coach-md-muted">[{alt}]</span> : null), // no remote images
  blockquote: ({ children }) => <div className="coach-md-callout">{children}</div>,
  pre: ({ children }) => <pre className="coach-md-pre">{children}</pre>,
  h1: ({ children }) => <h3 className="coach-md-h">{children}</h3>,
  h2: ({ children }) => <h3 className="coach-md-h">{children}</h3>,
  h3: ({ children }) => <h4 className="coach-md-h sm">{children}</h4>,
  h4: ({ children }) => <h4 className="coach-md-h sm">{children}</h4>,
  input: ({ checked }) => <input type="checkbox" checked={!!checked} readOnly tabIndex={-1} className="coach-md-check" />,
};

export default function CoachMarkdown({ text, streaming }) {
  return (
    <div className="coach-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {text || ""}
      </ReactMarkdown>
      {streaming && <span className="coach-caret" />}
    </div>
  );
}

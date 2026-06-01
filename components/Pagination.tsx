"use client";

/**
 * Lightweight client-side pagination control for admin tables.
 * Shows Prev / page numbers / Next and a "x–y of n" range note.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Compact page window: 1 … (p-1) p (p+1) … last
  const pages: (number | "…")[] = [];
  const push = (n: number | "…") => pages.push(n);
  const window = 1;
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || (i >= page - window && i <= page + window)) {
      push(i);
    } else if (pages[pages.length - 1] !== "…") {
      push("…");
    }
  }

  return (
    <div className="pager">
      <span className="pager-note">{from}–{to} of {total}</span>
      <div className="pager-controls">
        <button className="pager-btn" disabled={page === 1} onClick={() => onPage(page - 1)}>
          ‹ Prev
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="pager-gap">…</span>
          ) : (
            <button
              key={p}
              className={`pager-btn ${p === page ? "on" : ""}`}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        <button className="pager-btn" disabled={page === pageCount} onClick={() => onPage(page + 1)}>
          Next ›
        </button>
      </div>
    </div>
  );
}

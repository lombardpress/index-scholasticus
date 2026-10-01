"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LABELS } from "./CitationFilter";
import type { BookMeta, Facets } from "./types";

// Book table of contents on a source/work overview page, with the same
// author/work filter as the book pages. It filters against the precomputed
// per-book counts in <shortId>.facets.json (not the trees themselves), hides
// books with no matching citations, and passes the filter on to the book page
// via ?author=…&work=…. Note the book-page "work" filter also matches division
// labels ("Distinctio 2"); here it matches work titles only.

export default function BookToc({
  direction,
  bookBase,
  books,
  facets,
}: {
  direction: "forward" | "reverse";
  bookBase: string;
  books: BookMeta[];
  facets: Facets | null;
}) {
  const labels = LABELS[direction];
  const [author, setAuthor] = useState("");
  const [work, setWork] = useState("");
  const aq = author.trim().toLowerCase();
  const wq = work.trim().toLowerCase();
  const active = facets !== null && (aq !== "" || wq !== "");

  // Matching citation count per book index (null when no filter is active).
  const matches = useMemo(() => {
    if (!active || !facets) return null;
    const authorOk = facets.authors.map((a) => aq === "" || a.toLowerCase().includes(aq));
    const workOk = facets.works.map((w) => wq === "" || w.toLowerCase().includes(wq));
    const counts = new Array<number>(books.length).fill(0);
    for (const [b, a, w, n] of facets.rows) {
      if (authorOk[a] && workOk[w]) counts[b] += n;
    }
    return counts;
  }, [active, facets, aq, wq, books.length]);

  const query = new URLSearchParams();
  if (aq) query.set("author", author.trim());
  if (wq) query.set("work", work.trim());
  const qs = query.toString() ? `?${query}` : "";

  const shownBooks = matches ? books.filter((_, i) => matches[i] > 0).length : books.length;
  const shownCites = matches ? matches.reduce((s, n) => s + n, 0) : 0;

  return (
    <>
      {facets && (
        <div className="cite-filter toc-filter">
          <span className="cite-filter-label">Filter citations</span>
          <input
            className="cite-filter-input"
            placeholder={labels.author}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            aria-label={labels.authorAria}
          />
          <input
            className="cite-filter-input"
            placeholder={labels.work}
            value={work}
            onChange={(e) => setWork(e.target.value)}
            aria-label={labels.workAria}
          />
          {active && (
            <span className="cite-filter-count">
              {shownCites.toLocaleString()} citation{shownCites !== 1 ? "s" : ""} in{" "}
              {shownBooks} book{shownBooks !== 1 ? "s" : ""}
            </span>
          )}
          {active && (
            <button
              className="cite-filter-clear"
              onClick={() => {
                setAuthor("");
                setWork("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
      <div className="book-toc">
        {books.map((b, i) =>
          matches && matches[i] === 0 ? null : (
            <Link key={b.slug} href={`${bookBase}/${b.slug}${qs}`}>
              <span className="toc-title">{b.title}</span>
              <span className="toc-count">
                {matches ? `${matches[i].toLocaleString()} / ` : ""}
                {b.total.toLocaleString()}
              </span>
            </Link>
          )
        )}
      </div>
    </>
  );
}

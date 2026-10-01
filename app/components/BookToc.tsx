"use client";

import { useMemo } from "react";
import Link from "next/link";
import FilterBar, { useUrlFilter, type FilterDirection } from "./FilterBar";
import type { BookMeta, Facets } from "./types";

// Book table of contents on a source/work overview page, with the same
// author/work filter bar as the book pages. It filters against the precomputed
// per-book counts in <shortId>.facets.json (not the trees themselves), hides
// books with no matching citations, and the filter carries into the book page
// via ?author=…&work=…. Note the book-page "work" filter also matches division
// labels ("Distinctio 2"); here it matches work titles only.

export default function BookToc({
  direction,
  bookBase,
  books,
  facets,
}: {
  direction: FilterDirection;
  bookBase: string;
  books: BookMeta[];
  facets: Facets | null;
}) {
  const filter = useUrlFilter();
  const aq = filter.author.trim().toLowerCase();
  const wq = filter.work.trim().toLowerCase();
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
  if (aq) query.set("author", filter.author.trim());
  if (wq) query.set("work", filter.work.trim());
  const qs = query.toString() ? `?${query}` : "";

  const shownBooks = matches ? matches.filter((n) => n > 0).length : books.length;
  const shownCites = matches ? matches.reduce((s, n) => s + n, 0) : 0;
  const status = `${shownCites.toLocaleString()} citation${shownCites !== 1 ? "s" : ""} in ${shownBooks} book${
    shownBooks !== 1 ? "s" : ""
  }`;

  return (
    <>
      {facets && <FilterBar direction={direction} filter={filter} status={status} />}
      <div className="book-toc">
        {books.map((b, i) =>
          matches && matches[i] === 0 ? null : (
            // trailingSlash export: link to the slash form so static hosts
            // don't redirect (and drop the query string).
            <Link key={b.slug} href={`${bookBase}/${b.slug}/${qs}`}>
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

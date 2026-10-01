"use client";

import { useEffect, useState } from "react";

// The author/work filter bar shared by overview pages (filtering the book list)
// and book pages (filtering the citation tree), plus the hook that keeps its
// state in the URL (?author=…&work=…) so it carries from an overview into a
// book and survives reloads, sharing and the back button.

// In the reverse index the "author" level holds the cited source and the
// "work" level the cited book, so only the wording changes.
const LABELS = {
  forward: {
    author: "by author…",
    work: "by work title…",
    authorAria: "Filter by citing author",
    workAria: "Filter by citing work title",
  },
  reverse: {
    author: "by cited source…",
    work: "by cited book…",
    authorAria: "Filter by cited source",
    workAria: "Filter by cited book or division",
  },
};

export type FilterDirection = keyof typeof LABELS;

export function useUrlFilter() {
  const [state, setState] = useState({ author: "", work: "", ready: false });
  const { author, work, ready } = state;

  // Read the URL once on mount (a static export can't read search params at
  // build time). Syncing waits for this, or it would strip the incoming
  // params before they're read (effects run twice under StrictMode in dev).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setState({ author: params.get("author") || "", work: params.get("work") || "", ready: true });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    const set = (k: string, v: string) =>
      v.trim() ? url.searchParams.set(k, v.trim()) : url.searchParams.delete(k);
    set("author", author);
    set("work", work);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url.href);
  }, [author, work, ready]);

  return {
    author,
    work,
    setAuthor: (v: string) => setState((s) => ({ ...s, author: v })),
    setWork: (v: string) => setState((s) => ({ ...s, work: v })),
    clear: () => setState((s) => ({ ...s, author: "", work: "" })),
  };
}

export default function FilterBar({
  direction,
  filter,
  status,
}: {
  direction: FilterDirection;
  filter: ReturnType<typeof useUrlFilter>;
  status?: string | null; // e.g. "12 passages", shown while a filter is active
}) {
  const labels = LABELS[direction];
  const active = filter.author !== "" || filter.work !== "";

  return (
    <div className="cite-filter">
      <span className="cite-filter-label">Filter citations</span>
      <input
        className="cite-filter-input"
        placeholder={labels.author}
        value={filter.author}
        onChange={(e) => filter.setAuthor(e.target.value)}
        aria-label={labels.authorAria}
      />
      <input
        className="cite-filter-input"
        placeholder={labels.work}
        value={filter.work}
        onChange={(e) => filter.setWork(e.target.value)}
        aria-label={labels.workAria}
      />
      {active && status && <span className="cite-filter-count">{status}</span>}
      {active && (
        <button className="cite-filter-clear" onClick={filter.clear}>
          Clear
        </button>
      )}
    </div>
  );
}

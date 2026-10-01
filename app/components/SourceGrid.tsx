"use client";

import { useState } from "react";
import Link from "next/link";
import type { SourceIndexEntry } from "./types";

// Home-page card grid with a single filter box matched (case-insensitive
// substring) against each card's title, author and short id.

export default function SourceGrid({
  sources,
  basePath,
  noun,
}: {
  sources: SourceIndexEntry[];
  basePath: string;
  noun: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown =
    q === ""
      ? sources
      : sources.filter((s) =>
          [s.title, s.author || "", s.shortId].some((f) => f.toLowerCase().includes(q))
        );

  return (
    <>
      <div className="home-filter">
        <input
          type="search"
          className="cite-filter-input home-filter-input"
          placeholder="Filter by title, author, or id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Filter ${noun} by title, author, or id`}
        />
        {q !== "" && (
          <span className="cite-filter-count">
            {shown.length.toLocaleString()} of {sources.length.toLocaleString()} {noun}
          </span>
        )}
      </div>
      <div className="source-grid">
        {shown.map((s) => (
          <Link key={s.shortId} href={`${basePath}/${s.shortId}`} className="source-card">
            <div className="source-title">{s.title}</div>
            {s.author && <div className="source-author">{s.author}</div>}
            <div className="source-short">{s.shortId}</div>
            <div className="source-counts">
              <span>
                <b>{s.totalCitations.toLocaleString()}</b> citations
              </span>
              <span>
                <b>{s.totalPassages.toLocaleString()}</b> passages
              </span>
            </div>
          </Link>
        ))}
      </div>
      {shown.length === 0 && <p className="home-empty">No {noun} match “{query}”.</p>}
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import type { BookMeta } from "./types";

// Book navigation for a source. Each book is its own page, so book entries are
// links (not scroll-to actions) and the active book is driven by the route.

export default function Sidebar({
  sourceShortId,
  sourceTitle,
  books,
  totalPassages,
  totalCitations,
  activeBookSlug,
}: {
  sourceShortId: string;
  sourceTitle: string;
  books: BookMeta[];
  totalPassages: number;
  totalCitations: number;
  activeBookSlug?: string;
}) {
  const [filter, setFilter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const q = filter.toLowerCase();

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
      >
        {menuOpen ? "✕" : "☰"}
      </button>
      <aside id="sidebar" className={menuOpen ? "open" : ""}>
      <div id="sidebar-header">
        <h1>
          <Link href={`/source/${sourceShortId}`}>{sourceTitle}</Link>
        </h1>
        <div className="sidebar-credits">
          <Link href="/" className="site-name">
            Index Scholasticus
          </Link>
          <a className="credit" href="https://lombardpress.org" target="_blank" rel="noopener">
            A LombardPress Publication
          </a>
          <a className="credit" href="https://scta.info" target="_blank" rel="noopener">
            Powered by SCTA Data
          </a>
        </div>
      </div>
      <div id="sidebar-search">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          aria-label="Filter"
        />
      </div>
      <div id="book-list">
        {books.map((book) => {
          const active = book.slug === activeBookSlug;
          const hidden = q !== "" && !book.title.toLowerCase().includes(q);
          return (
            <Link
              key={book.slug}
              href={`/source/${sourceShortId}/${book.slug}`}
              className={"book-link" + (active ? " active" : "")}
              style={hidden ? { display: "none" } : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <span className="book-name">{book.title}</span>
              <span className="book-count">{book.total}</span>
            </Link>
          );
        })}
      </div>
      <div id="sidebar-footer">
        <div id="stats">
          {totalPassages.toLocaleString()} passages · {totalCitations.toLocaleString()} citations
        </div>
        <ThemeToggle />
      </div>
      </aside>
      {menuOpen && (
        <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";

// Client-side filter for a book page. The citation tree is static HTML injected
// into `#citation-tree`; here we filter it in place by the citing text's author
// and/or work title. Each field is matched as a whole (contiguous) substring —
// so "Distinctio 2" matches "…Distinctio 2…", not anything containing a "2".
// A verse survives if it still has at least one matching citation; matching
// branches are auto-expanded so results are visible.

function clearFilter(tree: HTMLElement) {
  tree
    .querySelectorAll<HTMLElement>(
      ".cit-node,.verse-row,.author-group,.work-group,.div-group,.citation-row"
    )
    .forEach((el) => {
      el.style.display = "";
      el.classList.remove("open");
    });
}

function applyFilter(
  tree: HTMLElement,
  authorQ: string,
  workQ: string
): number | null {
  const aq = authorQ.trim().toLowerCase();
  const wq = workQ.trim().toLowerCase();
  if (aq === "" && wq === "") {
    clearFilter(tree);
    return null;
  }

  // Start from a fully collapsed tree, then reveal only matching branches.
  tree
    .querySelectorAll<HTMLElement>(
      ".cit-node,.verse-row,.author-group,.work-group,.div-group,.citation-row"
    )
    .forEach((el) => {
      el.style.display = "none";
      el.classList.remove("open");
    });

  const verses = new Set<Element>();

  const authorTextFor = (el: Element) =>
    (
      el.closest(".author-group")?.querySelector(".author-name")?.textContent || ""
    ).toLowerCase();
  const isMatch = (authorText: string, otherText: string) =>
    (aq === "" || authorText.includes(aq)) && (wq === "" || otherText.includes(wq));

  const reveal = (el: HTMLElement) => {
    el.style.display = "";
    el.classList.add("open");
  };

  // A matched work-group reveals its whole subtree — every nested division
  // and citation row under it, regardless of that division's own text.
  const revealSubtree = (root: HTMLElement) => {
    reveal(root);
    root
      .querySelectorAll<HTMLElement>(".work-group,.div-group,.citation-row")
      .forEach(reveal);
  };

  // Walk up from a matched leaf, opening every ancestor container on the way
  // so the match is actually visible.
  const revealAncestors = (leaf: Element) => {
    let el: Element | null = leaf.parentElement;
    while (el && el !== tree) {
      if (el.matches(".author-group,.verse-row,.cit-node,.work-group,.div-group")) {
        reveal(el as HTMLElement);
        if (el.matches(".verse-row")) verses.add(el);
      }
      el = el.parentElement;
    }
  };

  // A work-group only exists once its own subtree branches (a single-branch
  // work collapses into a flat .citation-row instead) — matching on its
  // title still makes sense as a coarser "show everything under this work"
  // filter.
  tree.querySelectorAll<HTMLElement>(".work-group").forEach((wg) => {
    const workText = (wg.querySelector(".work-title")?.textContent || "").toLowerCase();
    if (isMatch(authorTextFor(wg), workText)) {
      revealSubtree(wg);
      revealAncestors(wg);
    }
  });

  // A collapsed single-branch chain: match against the full citation path
  // shown on its one remaining row (it already carries the work title and
  // every division label along the way, so a "work title" search still
  // finds it).
  tree.querySelectorAll<HTMLElement>(".citation-row").forEach((row) => {
    const pathText = (row.textContent || "").toLowerCase();
    if (isMatch(authorTextFor(row), pathText)) {
      reveal(row);
      revealAncestors(row);
    }
  });

  return verses.size;
}

// In the reverse index the "author" level holds the cited source and the
// "work" level the cited book, so only the wording changes.
export const LABELS = {
  forward: { author: "by author…", work: "by work title…", authorAria: "Filter by citing author", workAria: "Filter by citing work title" },
  reverse: { author: "by cited source…", work: "by cited book…", authorAria: "Filter by cited source", workAria: "Filter by cited book or division" },
};

export default function CitationFilter({
  targetId,
  direction = "forward",
}: {
  targetId: string;
  direction?: "forward" | "reverse";
}) {
  const labels = LABELS[direction];
  const [author, setAuthor] = useState("");
  const [work, setWork] = useState("");
  const [count, setCount] = useState<number | null>(null);

  // The overview page links here with ?author=…&work=… prefilled; read them
  // once on mount (a static export can't read search params at build time).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAuthor(params.get("author") || "");
    setWork(params.get("work") || "");
  }, []);

  // Keep the URL in sync so a filtered view can be reloaded or shared.
  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (k: string, v: string) =>
      v.trim() ? url.searchParams.set(k, v.trim()) : url.searchParams.delete(k);
    set("author", author);
    set("work", work);
    if (url.href !== window.location.href) window.history.replaceState(null, "", url.href);
  }, [author, work]);

  useEffect(() => {
    const tree = document.getElementById(targetId);
    if (!tree) return;
    const handle = setTimeout(() => setCount(applyFilter(tree, author, work)), 180);
    return () => clearTimeout(handle);
  }, [author, work, targetId]);

  const active = author !== "" || work !== "";

  return (
    <div className="cite-filter">
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
      {active && count !== null && (
        <span className="cite-filter-count">
          {count} passage{count !== 1 ? "s" : ""}
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
  );
}

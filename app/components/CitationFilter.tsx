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

export default function CitationFilter({ targetId }: { targetId: string }) {
  const [author, setAuthor] = useState("");
  const [work, setWork] = useState("");
  const [count, setCount] = useState<number | null>(null);

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
        placeholder="by author…"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        aria-label="Filter by citing author"
      />
      <input
        className="cite-filter-input"
        placeholder="by work title…"
        value={work}
        onChange={(e) => setWork(e.target.value)}
        aria-label="Filter by citing work title"
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

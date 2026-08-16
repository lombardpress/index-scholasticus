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
      ".cit-node,.verse-row,.author-group,.work-group,.div-group"
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

  const visible = new Set<Element>();
  const verses = new Set<Element>();

  // Leaf decision: each work-group matches if its author + work title contain
  // all the given tokens. Walk up to mark ancestor containers visible.
  tree.querySelectorAll<HTMLElement>(".work-group").forEach((wg) => {
    const workText = (wg.querySelector(".work-title")?.textContent || "").toLowerCase();
    const ag = wg.closest(".author-group");
    const authorText = (ag?.querySelector(".author-name")?.textContent || "").toLowerCase();
    const match =
      (aq === "" || authorText.includes(aq)) && (wq === "" || workText.includes(wq));

    wg.style.display = match ? "" : "none";
    if (!match) {
      wg.classList.remove("open");
      return;
    }
    wg.classList.add("open");
    // Reveal every citation under the matched work (open nested divisions).
    wg.querySelectorAll(".div-group").forEach((d) => d.classList.add("open"));
    let el: Element | null = wg.parentElement;
    while (el && el !== tree) {
      if (el.matches(".author-group,.verse-row,.cit-node")) {
        visible.add(el);
        if (el.matches(".verse-row")) verses.add(el);
      }
      el = el.parentElement;
    }
  });

  // Show only the containers on a path to a matching citation; open them so the
  // matches are revealed. Hide the rest.
  tree
    .querySelectorAll<HTMLElement>(".author-group,.verse-row,.cit-node")
    .forEach((el) => {
      if (visible.has(el)) {
        el.style.display = "";
        el.classList.add("open");
      } else {
        el.style.display = "none";
        el.classList.remove("open");
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

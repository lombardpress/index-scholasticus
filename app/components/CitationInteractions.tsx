"use client";

import { useEffect, useState } from "react";
import CompareModal, { type CompareTarget } from "./CompareModal";

// Delegated interactivity for the statically-injected citation tree:
//  - clicking any header toggles the `.open` class (collapse/expand)
//  - clicking a citation (.para-uri) opens the text-comparison modal instead of
//    navigating to the raw resource id.
// The tree HTML is injected via dangerouslySetInnerHTML, so it isn't part of
// React's tree — we attach one delegated listener to the container.

const HEADER_SELECTOR =
  ".cit-header,.verse-header,.author-header,.work-header,.div-header";

export default function CitationInteractions({ targetId }: { targetId: string }) {
  const [target, setTarget] = useState<CompareTarget | null>(null);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;

      // Citation click → open comparison modal.
      const para = el.closest(".para-uri") as HTMLAnchorElement | null;
      if (para) {
        e.preventDefault();
        const verse = para.closest(".verse-row") as HTMLElement | null;
        const quoteId = para.getAttribute("href") || "";
        const sourceId = verse?.dataset.sourceId || "";
        const sourceLabel = verse?.dataset.sourceLabel || "";
        if (quoteId && sourceId) setTarget({ quoteId, sourceId, sourceLabel });
        return;
      }

      // Any other link (e.g. the external "open in viewer" icon) navigates
      // normally and must not toggle the surrounding header.
      if (el.closest("a")) return;

      // Header click → toggle collapse/expand.
      const header = el.closest(HEADER_SELECTOR);
      if (!header) return;
      header.parentElement?.classList.toggle("open");
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [targetId]);

  return target ? (
    <CompareModal target={target} onClose={() => setTarget(null)} />
  ) : null;
}

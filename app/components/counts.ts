// Pure counting helpers ported from the HTML_POST block of
// citation_list_to_html.py. Shared by the server renderers and the sidebar.

import type { CitationTrieNode, CiteTrieNode, Book } from "./types";

// Total citations beneath a cited-text trie node (sum of leaf citeCounts).
export function countCitNode(node: CitationTrieNode): number {
  return (
    node.paras.reduce((s, p) => s + p.citeCount, 0) +
    node.children.reduce((s, c) => s + countCitNode(c), 0)
  );
}

// Total leaf passages beneath a cited-text trie node.
export function countPassages(node: CitationTrieNode): number {
  return node.paras.length + node.children.reduce((s, c) => s + countPassages(c), 0);
}

// Total citing paragraphs beneath a citing-text (author/work/division) node.
export function countCiteNode(node: CiteTrieNode): number {
  return node.paras.length + node.children.reduce((s, c) => s + countCiteNode(c), 0);
}

export function bookTotal(book: Book): number {
  return countCitNode(book);
}

// Stable DOM ids/anchors from arbitrary uris.
export function safeId(s: string): string {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "_");
}

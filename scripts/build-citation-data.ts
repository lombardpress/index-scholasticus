/**
 * build-citation-data.ts
 *
 * Faithful Node/TS port of scta-scikit/examples/citation_list_to_html.py.
 * Reads the full citation_index.json (~110 MB) and emits one JSON file per
 * top-level source into app/data/citations/<shortId>.json, plus an index.json
 * describing every source (for the home page + sidebar totals).
 *
 * Run under tsx with a raised heap:
 *   NODE_OPTIONS=--max-old-space-size=8192 tsx scripts/build-citation-data.ts [INPUT_JSON]
 */

import fs from "fs";
import path from "path";

// ── Input / output paths ──────────────────────────────────────────────────────

const INPUT =
  process.argv[2] ||
  process.env.CITATION_INDEX ||
  path.resolve(process.cwd(), "../scta-scikit/examples/citation_index.json");

const OUT_DIR = path.resolve(process.cwd(), "app/data/citations");

// ── Raw shapes (subset of citation_index.json) ────────────────────────────────

interface Ancestor {
  id?: string;
  level?: number;
  longTitle?: string | null;
  author?: string | null;
  authorTitle?: string | null;
  order?: number | null;
}
interface Paragraph {
  para_block: string;
  ancestors: Ancestor[];
}
interface Entry {
  citation_ancestors: Ancestor[];
  paragraphs: Paragraph[];
}

// ── Output shapes ─────────────────────────────────────────────────────────────

interface CiteTrieNode {
  label: string;
  paras: { uri: string }[];
  children: CiteTrieNode[];
}
interface Work {
  title: string;
  count: number;
  paras: { uri: string }[];
  children: CiteTrieNode[];
}
interface Group {
  author: string;
  count: number;
  works: Work[];
}
interface Leaf {
  id: string;
  shortId: string;
  verseNum: string;
  order: number;
  citeCount: number;
  groups: Group[];
}
interface CitationTrieNode {
  label: string;
  order: number;
  paras: Leaf[];
  children: CitationTrieNode[];
}
interface Book extends Omit<CitationTrieNode, "label"> {
  id: string;
  title: string;
}

// Mutable trie node used while building (children keyed by a Map to preserve
// Python dict insertion order).
interface MutTrie {
  label?: string;
  order?: number;
  paras: Leaf[];
  children: Map<string, MutTrie>;
}
interface MutBook extends MutTrie {
  id: string;
  title: string;
  order: number;
}

// ── Trie helpers (ports of the Python functions) ──────────────────────────────

function insertCitationTrie(node: MutTrie, pathArr: Ancestor[], leaf: Leaf): void {
  if (pathArr.length === 0) {
    node.paras.push(leaf);
    return;
  }
  const head = pathArr[0];
  const key = head.id || head.longTitle || "";
  let child = node.children.get(key);
  if (!child) {
    child = {
      label: head.longTitle || key.split("/").pop() || "",
      order: head.order || 9999,
      paras: [],
      children: new Map(),
    };
    node.children.set(key, child);
  }
  insertCitationTrie(child, pathArr.slice(1), leaf);
}

function serializeCitationTrie(node: MutTrie): CitationTrieNode[] {
  const children = [...node.children.values()].sort(
    (a, b) => (a.order ?? 9999) - (b.order ?? 9999)
  );
  return children.map((c) => ({
    label: c.label ?? "",
    order: c.order ?? 9999,
    paras: [...c.paras].sort((a, b) => a.order - b.order),
    children: serializeCitationTrie(c),
  }));
}

// Citing-text trie (divisions within a single work).
interface MutCite {
  paras: { uri: string }[];
  children: Map<string, MutCite>;
}

function buildCiteTrie(paras: { uri: string; divs: string[] }[]): MutCite {
  const root: MutCite = { paras: [], children: new Map() };
  for (const p of paras) {
    let node = root;
    for (const div of p.divs) {
      let child = node.children.get(div);
      if (!child) {
        child = { paras: [], children: new Map() };
        node.children.set(div, child);
      }
      node = child;
    }
    node.paras.push({ uri: p.uri });
  }
  return root;
}

function serializeCiteTrie(node: MutCite): CiteTrieNode[] {
  const out: CiteTrieNode[] = [];
  for (const [label, child] of node.children) {
    out.push({ label, paras: child.paras, children: serializeCiteTrie(child) });
  }
  return out;
}

// ── Per-source build ──────────────────────────────────────────────────────────

function buildSource(sourceEntries: [string, Entry][]): Book[] {
  const booksDict = new Map<string, MutBook>();

  for (const [uri, entry] of sourceEntries) {
    const ca = entry.citation_ancestors;
    if (ca.length < 2) continue;

    const bookNode = ca[1];
    const bookId = bookNode.id || "";

    let book = booksDict.get(bookId);
    if (!book) {
      book = {
        id: bookId,
        title: bookNode.longTitle || bookId.split("/").pop() || "",
        order: bookNode.order || 9999,
        paras: [],
        children: new Map(),
      };
      booksDict.set(bookId, book);
    }

    // author -> work -> [{uri, divs}]
    const authorWorkMap = new Map<string, Map<string, { uri: string; divs: string[] }[]>>();
    for (const p of entry.paragraphs) {
      const anc = p.ancestors;
      const authorAnc = anc.find((a) => a.authorTitle || a.author);
      const author = authorAnc
        ? (authorAnc.authorTitle || authorAnc.author)!
        : "Unknown";
      const workAnc = anc.find((a) => a.level === 2 && a.longTitle);
      const work = workAnc?.longTitle || "Unknown work";
      const divs = anc
        .filter((a) => (a.level ?? 0) >= 3 && a.longTitle)
        .map((a) => a.longTitle as string);

      if (!authorWorkMap.has(author)) authorWorkMap.set(author, new Map());
      const works = authorWorkMap.get(author)!;
      if (!works.has(work)) works.set(work, []);
      works.get(work)!.push({ uri: p.para_block, divs });
    }

    const groups: Group[] = [];
    for (const [author, works] of authorWorkMap) {
      const workList: Work[] = [];
      for (const [work, workParas] of works) {
        const trie = buildCiteTrie(workParas);
        workList.push({
          title: work,
          count: workParas.length,
          paras: trie.paras,
          children: serializeCiteTrie(trie),
        });
      }
      groups.push({
        author,
        count: workList.reduce((s, w) => s + w.count, 0),
        works: workList,
      });
    }

    const leafNode = ca[ca.length - 1];
    const pathArr = ca.length > 2 ? ca.slice(2, ca.length - 1) : [];
    const sid = uri.split("/").pop() || uri;
    const verseNum = sid.includes("_") ? sid.slice(sid.lastIndexOf("_") + 1) : sid;

    const leaf: Leaf = {
      id: uri,
      shortId: sid,
      verseNum,
      order: leafNode.order || 9999,
      citeCount: entry.paragraphs.length,
      groups,
    };

    insertCitationTrie(book, pathArr, leaf);
  }

  const books = [...booksDict.values()].sort((a, b) => a.order - b.order);
  return books.map((bk) => ({
    id: bk.id,
    title: bk.title,
    order: bk.order,
    paras: [...bk.paras].sort((a, b) => a.order - b.order),
    children: serializeCitationTrie(bk),
  }));
}

// ── Count helpers (ported from HTML_POST) ─────────────────────────────────────

function countCitNode(node: { paras: Leaf[]; children: CitationTrieNode[] }): number {
  return (
    node.paras.reduce((s, p) => s + p.citeCount, 0) +
    node.children.reduce((s, c) => s + countCitNode(c), 0)
  );
}
function countPassages(node: { paras: Leaf[]; children: CitationTrieNode[] }): number {
  return node.paras.length + node.children.reduce((s, c) => s + countPassages(c), 0);
}
function countCiteNode(node: CiteTrieNode): number {
  return node.paras.length + node.children.reduce((s, c) => s + countCiteNode(c), 0);
}

// ── HTML string renderers (ports of HTML_POST) ────────────────────────────────
// Emit the exact compact markup the original tool produced. Building the tree as
// a plain HTML string (rather than a React server-component tree) keeps the
// exported page small — the fragment is injected via dangerouslySetInnerHTML and
// never enters React's flight payload as an element tree.

function esc(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function safeId(s: string): string {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "_");
}

// External-link icon jumping to the SCTA viewer for a resource id. Kept in sync
// with app/components/ExtLink.tsx (same icon, used in the comparison modal).
const VIEWER_BASE = "https://scta.lombardpress.org/res?resourceid=";
const EXT_ICON =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
function extLink(resourceUri: string, title: string): string {
  return `<a class="ext-link" href="${VIEWER_BASE}${esc(
    resourceUri
  )}" target="_blank" rel="noopener" title="${esc(title)}">${EXT_ICON}</a>`;
}

function renderCiteTrie(paras: { uri: string }[], children: CiteTrieNode[], indent: number): string {
  let h = "";
  for (const p of paras) {
    h += `<div class="para-entry" style="padding-left:${indent}px"><a class="para-uri" href="${esc(
      p.uri
    )}" target="_blank" rel="noopener" title="Click to view and compare with the source text">${esc(
      p.uri
    )}</a>${extLink(p.uri, "Open citing text in SCTA viewer")}</div>`;
  }
  for (const child of children) {
    const cnt = countCiteNode(child);
    h += `<div class="div-group"><div class="div-header" style="padding:5px 12px 5px ${indent}px"><span class="div-toggle">►</span><span class="div-label">${esc(
      child.label
    )}</span><span class="group-count">${cnt}</span></div><div class="div-body">${renderCiteTrie(
      child.paras,
      child.children,
      indent + 16
    )}</div></div>`;
  }
  return h;
}

function renderGroups(groups: Group[]): string {
  let h = "";
  for (const g of groups) {
    h += `<div class="author-group"><div class="author-header"><span class="author-toggle">►</span><span class="author-name">${esc(
      g.author
    )}</span><span class="group-count">${g.count} citation${g.count !== 1 ? "s" : ""}</span></div><div class="author-body">`;
    for (const w of g.works) {
      h += `<div class="work-group"><div class="work-header"><span class="work-toggle">►</span><span class="work-title">${esc(
        w.title
      )}</span><span class="group-count">${w.count}</span></div><div class="work-body">${renderCiteTrie(
        w.paras,
        w.children,
        40
      )}</div></div>`;
    }
    h += `</div></div>`;
  }
  return h;
}

function renderVerse(v: Leaf, headerIndent: number): string {
  return `<div class="verse-row" id="v-${safeId(v.id)}" data-source-id="${esc(
    v.id
  )}" data-source-label="v. ${esc(v.verseNum)} (${esc(v.shortId)})"><div class="verse-header" style="padding:8px 8px 8px ${headerIndent}px"><span class="verse-toggle">►</span><span class="verse-label">v.&nbsp;${esc(
    v.verseNum
  )}<span class="verse-shortid">${esc(v.shortId)}</span></span><span class="verse-badge">${v.citeCount}</span>${extLink(
    v.id,
    "Open source passage in SCTA viewer"
  )}</div><div class="verse-cites">${renderGroups(v.groups)}</div></div>`;
}

function renderCitationTrie(node: { paras: Leaf[]; children: CitationTrieNode[] }, depth: number): string {
  const indent = 32 + depth * 16;
  let h = "";
  for (const v of node.paras) h += renderVerse(v, indent);
  for (const child of node.children) {
    const cnt = countCitNode(child);
    h += `<div class="cit-node"><div class="cit-header" style="padding:10px 8px 10px ${indent}px"><span class="cit-toggle">►</span><span class="cit-label">${esc(
      child.label
    )}</span><span class="cit-count">${cnt}</span></div><div class="cit-body">${renderCitationTrie(
      child,
      depth + 1
    )}</div></div>`;
  }
  return h;
}

function renderBook(book: Book): string {
  const bt = countCitNode(book);
  return `<section class="book-section" id="book-${safeId(book.id)}"><div class="book-section-header"><h2>${esc(
    book.title
  )}</h2><span class="book-total-badge">${bt} citation${bt !== 1 ? "s" : ""}</span></div>${renderCitationTrie(
    book,
    0
  )}</section>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Loading ${INPUT} ...`);
  const raw = fs.readFileSync(INPUT, "utf-8");
  const citationIndex: Record<string, Entry> = JSON.parse(raw);
  console.log(`Loaded ${Object.keys(citationIndex).length} entries`);

  // Group entries by their top-level source (ca[0].id).
  const bySource = new Map<string, [string, Entry][]>();
  const sourceTitles = new Map<string, string>();
  for (const [uri, entry] of Object.entries(citationIndex)) {
    const ca = entry.citation_ancestors;
    if (!ca || ca.length === 0) continue;
    const srcId = ca[0].id;
    if (!srcId) continue;
    if (!bySource.has(srcId)) {
      bySource.set(srcId, []);
      sourceTitles.set(srcId, ca[0].longTitle || srcId.split("/").pop() || srcId);
    }
    bySource.get(srcId)!.push([uri, entry]);
  }
  console.log(`Found ${bySource.size} distinct sources`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const index: {
    id: string;
    shortId: string;
    title: string;
    totalPassages: number;
    totalCitations: number;
  }[] = [];

  for (const [srcId, entries] of bySource) {
    const shortId = srcId.replace(/\/$/, "").split("/").pop() || srcId;
    const books = buildSource(entries);

    const totalCitations = books.reduce((s, b) => s + countCitNode(b), 0);
    const totalPassages = books.reduce((s, b) => s + countPassages(b), 0);
    const title = sourceTitles.get(srcId) || shortId;

    // Assign a URL-safe slug to each book (unique within the source) and
    // pre-render each book to its own compact HTML fragment, so no single page
    // ever carries the whole source. This keeps every page small as the corpus
    // grows. app/data/citations/<shortId>/<bookSlug>.html
    const usedSlugs = new Map<string, number>();
    const bookMetas = books.map((b) => {
      const base = safeId(b.id.split("/").pop() || b.id) || "book";
      const seen = usedSlugs.get(base) || 0;
      const slug = seen === 0 ? base : `${base}-${seen + 1}`;
      usedSlugs.set(base, seen + 1);
      return { slug, id: b.id, title: b.title, total: countCitNode(b), book: b };
    });

    const srcDir = path.join(OUT_DIR, shortId);
    fs.mkdirSync(srcDir, { recursive: true });
    for (const bm of bookMetas) {
      fs.writeFileSync(path.join(srcDir, `${bm.slug}.html`), renderBook(bm.book));
    }

    const meta = {
      id: srcId,
      shortId,
      title,
      totalPassages,
      totalCitations,
      books: bookMetas.map(({ slug, id, title: bt, total }) => ({ slug, id, title: bt, total })),
    };
    fs.writeFileSync(path.join(OUT_DIR, `${shortId}.meta.json`), JSON.stringify(meta));

    index.push({ id: srcId, shortId, title, totalPassages, totalCitations });
  }

  // Sort index by citation count (desc) so the home page leads with the richest.
  index.sort((a, b) => b.totalCitations - a.totalCitations);
  fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2));

  console.log(`Wrote ${index.length} source files + index.json to ${OUT_DIR}`);
}

main();

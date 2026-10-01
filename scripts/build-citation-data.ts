/**
 * build-citation-data.ts
 *
 * Faithful Node/TS port of scta-scikit/examples/citation_list_to_html.py.
 * Reads the full citation_index.json (~110 MB) and emits, per top-level work, a
 * <shortId>.meta.json, a <shortId>.facets.json (per-book author/work counts for
 * the overview filter), one pre-rendered HTML fragment per book, and an
 * index.json describing every work (for the home page + sidebar totals). It
 * does this twice: forward (cited source → citing texts) into
 * app/data/citations/, and reversed (citing work → cited passages) into
 * app/data/cites/.
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
  "/Users/jcwitt/Projects/scta/scta-scikit/examples/citation_index.json";

const DATA_DIR = path.resolve(process.cwd(), "app/data");

// The index is built in both directions from the same edges:
//  - "forward" (cited source → passage → citing texts) into app/data/citations/
//  - "reverse" (citing work → paragraph → cited passages) into app/data/cites/
type Direction = "forward" | "reverse";
const OUT_DIRS: Record<Direction, string> = {
  forward: path.join(DATA_DIR, "citations"),
  reverse: path.join(DATA_DIR, "cites"),
};

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
  label: string;
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

// Some works have an empty top-level title, so their descendants' longTitles
// come out as ", Liber primus". Drop that leading separator.
function cleanTitle(t: string | null | undefined): string {
  return (t || "").replace(/^(\s*,)+\s*/, "");
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
      label: cleanTitle(head.longTitle) || key.split("/").pop() || "",
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

// The group (top-level heading under each leaf) for one linked text: in the
// forward index the citing author; in the reverse index the cited source's
// title (cited sources rarely carry an author).
function groupLabel(anc: Ancestor[], direction: Direction): string {
  if (direction === "reverse") {
    const top = anc[0];
    const title = top?.longTitle || top?.id?.split("/").pop() || "Unknown source";
    const author = top?.authorTitle || top?.author;
    return author ? `${author}, ${title}` : title;
  }
  const authorAnc = anc.find((a) => a.authorTitle || a.author);
  return authorAnc ? (authorAnc.authorTitle || authorAnc.author)! : "Unknown";
}

function buildSource(sourceEntries: [string, Entry][], direction: Direction): Book[] {
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
        title: cleanTitle(bookNode.longTitle) || bookId.split("/").pop() || "",
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
      const author = groupLabel(anc, direction);
      const workAnc = anc.find((a) => a.level === 2 && a.longTitle);
      const work = cleanTitle(workAnc?.longTitle) || "Unknown work";
      const divs = anc
        .filter((a) => (a.level ?? 0) >= 3 && a.longTitle)
        .map((a) => cleanTitle(a.longTitle));

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
    // Forward leaves are cited passages ("v. 13"); reverse leaves are citing
    // paragraphs, whose ids carry no meaningful number.
    const label =
      direction === "reverse"
        ? "¶"
        : `v. ${sid.includes("_") ? sid.slice(sid.lastIndexOf("_") + 1) : sid}`;

    const leaf: Leaf = {
      id: uri,
      shortId: sid,
      label,
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

// ── Facets (overview-page filter) ─────────────────────────────────────────────

// Citation counts per (book, author, work) for a whole source, so the overview
// page can filter its book list by author/work without loading every book's
// tree. Strings are interned to keep the file small:
//   { authors: string[], works: string[], rows: [book, author, work, count][] }
interface Facets {
  authors: string[];
  works: string[];
  rows: [number, number, number, number][];
}

function forEachLeaf(node: { paras: Leaf[]; children: CitationTrieNode[] }, fn: (l: Leaf) => void) {
  node.paras.forEach(fn);
  node.children.forEach((c) => forEachLeaf(c, fn));
}

function buildFacets(books: Book[]): Facets {
  const authors: string[] = [];
  const works: string[] = [];
  const authorIdx = new Map<string, number>();
  const workIdx = new Map<string, number>();
  const intern = (m: Map<string, number>, list: string[], v: string) => {
    let i = m.get(v);
    if (i === undefined) {
      i = list.length;
      list.push(v);
      m.set(v, i);
    }
    return i;
  };

  const rows: [number, number, number, number][] = [];
  books.forEach((book, bi) => {
    const counts = new Map<string, number>();
    forEachLeaf(book, (leaf) => {
      for (const g of leaf.groups) {
        const a = intern(authorIdx, authors, g.author);
        for (const w of g.works) {
          const key = `${a}|${intern(workIdx, works, w.title)}`;
          counts.set(key, (counts.get(key) || 0) + w.count);
        }
      }
    });
    for (const [key, n] of counts) {
      const [a, w] = key.split("|").map(Number);
      rows.push([bi, a, w, n]);
    }
  });
  return { authors, works, rows };
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

function renderParaEntry(uri: string, indent: number): string {
  return `<div class="para-entry" style="padding-left:${indent}px"><a class="para-uri" href="${esc(
    uri
  )}" target="_blank" rel="noopener" title="Click to view and compare with the source text">${esc(
    uri
  )}</a>${extLink(uri, "Open citing text in SCTA viewer")}</div>`;
}

function renderCitationRow(label: string, uri: string, indent: number): string {
  return `<div class="citation-row" style="padding-left:${indent}px"><div class="citation-path">${esc(
    label
  )}</div><div class="citation-link"><a class="para-uri" href="${esc(
    uri
  )}" target="_blank" rel="noopener" title="Click to view and compare with the source text">${esc(
    uri
  )}</a>${extLink(uri, "Open citing text in SCTA viewer")}</div></div>`;
}

// Renders one node of the author/work/division chain, collapsing any run of
// single-branch levels into a single row instead of a chain of nested
// headers that each just repeat the same lone citation. A node's own label
// (via CiteTrieNode.label / Work.title) already carries the full ancestor
// path, so once a run of single-branch levels bottoms out — either at the
// lone citing paragraph, or at the first real fork — we only need to render
// that final node's label, not every intermediate one.
function renderChain(
  label: string,
  paras: { uri: string }[],
  children: CiteTrieNode[],
  indent: number,
  headerClass: "work-group" | "div-group"
): string {
  const branchCount = paras.length + children.length;

  if (branchCount === 1 && paras.length === 1) {
    return renderCitationRow(label, paras[0].uri, indent);
  }
  if (branchCount === 1 && children.length === 1) {
    const only = children[0];
    return renderChain(only.label, only.paras, only.children, indent, "div-group");
  }

  // Real fork: render one header for this level, with its own paras plus a
  // recursively-collapsed row for each child branch.
  const cnt = paras.length + children.reduce((s, c) => s + countCiteNode(c), 0);
  let body = "";
  for (const p of paras) body += renderParaEntry(p.uri, indent + 16);
  for (const c of children) {
    body += renderChain(c.label, c.paras, c.children, indent + 16, "div-group");
  }
  const short = headerClass === "work-group" ? "work" : "div";
  const labelClass = short === "work" ? "work-title" : "div-label";
  return `<div class="${headerClass}"><div class="${short}-header" style="padding:5px 12px 5px ${indent}px"><span class="${short}-toggle">►</span><span class="${labelClass}">${esc(
    label
  )}</span><span class="group-count">${cnt}</span></div><div class="${short}-body">${body}</div></div>`;
}

function renderWorksList(works: Work[], indent: number): string {
  let h = "";
  for (const w of works) h += renderChain(w.title, w.paras, w.children, indent, "work-group");
  return h;
}

function renderGroups(groups: Group[]): string {
  let h = "";
  for (const g of groups) {
    h += `<div class="author-group"><div class="author-header"><span class="author-toggle">►</span><span class="author-name">${esc(
      g.author
    )}</span><span class="group-count">${g.count} citation${g.count !== 1 ? "s" : ""}</span></div><div class="author-body">${renderWorksList(
      g.works,
      40
    )}</div></div>`;
  }
  return h;
}

function renderVerse(v: Leaf, headerIndent: number): string {
  return `<div class="verse-row" id="v-${safeId(v.id)}" data-source-id="${esc(
    v.id
  )}" data-source-label="${esc(v.label)} (${esc(v.shortId)})"><div class="verse-header" style="padding:8px 8px 8px ${headerIndent}px"><span class="verse-toggle">►</span><span class="verse-label">${esc(v.label).replace(
    " ",
    "&nbsp;"
  )}<span class="verse-shortid">${esc(v.shortId)}</span></span><span class="verse-badge">${v.citeCount}</span>${extLink(
    v.id,
    "Open passage in SCTA viewer"
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

// The book's title and totals are rendered by the page header (app/components
// /PageHeader.tsx), shared with the overview page, so the fragment is the tree only.
function renderBook(book: Book, direction: Direction): string {
  return `<section class="book-section" id="book-${safeId(book.id)}" data-direction="${direction}">${renderCitationTrie(
    book,
    0
  )}</section>`;
}

// ── Reversal ──────────────────────────────────────────────────────────────────

// Flip every edge: key the index by citing paragraph, whose "citation
// ancestors" become its own ancestor chain and whose "paragraphs" become the
// passages it cites (each carrying the cited passage's ancestor chain). The
// result has the same shape as the forward index, so it runs through the same
// build + render pipeline.
function reverseIndex(citationIndex: Record<string, Entry>): Record<string, Entry> {
  const reversed: Record<string, Entry> = {};
  for (const [citedUri, entry] of Object.entries(citationIndex)) {
    for (const p of entry.paragraphs) {
      let r = reversed[p.para_block];
      if (!r) {
        r = { citation_ancestors: p.ancestors, paragraphs: [] };
        reversed[p.para_block] = r;
      }
      r.paragraphs.push({ para_block: citedUri, ancestors: entry.citation_ancestors });
    }
  }
  return reversed;
}

// ── Emit one direction ────────────────────────────────────────────────────────

function emitIndex(citationIndex: Record<string, Entry>, direction: Direction): void {
  const outDir = OUT_DIRS[direction];

  // Group entries by their top-level source (ca[0].id).
  const bySource = new Map<string, [string, Entry][]>();
  const sourceTitles = new Map<string, string>();
  const sourceAuthors = new Map<string, string>();
  for (const [uri, entry] of Object.entries(citationIndex)) {
    const ca = entry.citation_ancestors;
    if (!ca || ca.length === 0) continue;
    const srcId = ca[0].id;
    if (!srcId) continue;
    if (!bySource.has(srcId)) {
      bySource.set(srcId, []);
      sourceTitles.set(srcId, ca[0].longTitle || srcId.split("/").pop() || srcId);
    }
    // Citing works share generic titles ("Commentarius in libros
    // Sententiarum"), so carry the author along to tell them apart.
    const author = ca.find((a) => a.authorTitle || a.author);
    if (author && !sourceAuthors.has(srcId)) {
      sourceAuthors.set(srcId, (author.authorTitle || author.author)!);
    }
    bySource.get(srcId)!.push([uri, entry]);
  }
  console.log(`[${direction}] Found ${bySource.size} distinct top-level works`);

  // Start clean so removed sources/books don't leave stale fragments behind.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const index: {
    id: string;
    shortId: string;
    title: string;
    author?: string;
    totalPassages: number;
    totalCitations: number;
  }[] = [];

  for (const [srcId, entries] of bySource) {
    const shortId = srcId.replace(/\/$/, "").split("/").pop() || srcId;
    const books = buildSource(entries, direction);

    const totalCitations = books.reduce((s, b) => s + countCitNode(b), 0);
    const totalPassages = books.reduce((s, b) => s + countPassages(b), 0);
    const title = sourceTitles.get(srcId) || shortId;
    const author = sourceAuthors.get(srcId);

    // Assign a URL-safe slug to each book (unique within the source) and
    // pre-render each book to its own compact HTML fragment, so no single page
    // ever carries the whole source. This keeps every page small as the corpus
    // grows. <outDir>/<shortId>/<bookSlug>.html
    const usedSlugs = new Map<string, number>();
    const bookMetas = books.map((b) => {
      const base = safeId(b.id.split("/").pop() || b.id) || "book";
      const seen = usedSlugs.get(base) || 0;
      const slug = seen === 0 ? base : `${base}-${seen + 1}`;
      usedSlugs.set(base, seen + 1);
      return {
        slug,
        id: b.id,
        title: b.title,
        total: countCitNode(b),
        passages: countPassages(b),
        book: b,
      };
    });

    const srcDir = path.join(outDir, shortId);
    fs.mkdirSync(srcDir, { recursive: true });
    for (const bm of bookMetas) {
      fs.writeFileSync(path.join(srcDir, `${bm.slug}.html`), renderBook(bm.book, direction));
    }

    const meta = {
      id: srcId,
      shortId,
      title,
      author,
      totalPassages,
      totalCitations,
      books: bookMetas.map(({ book: _book, ...bm }) => bm),
    };
    fs.writeFileSync(path.join(outDir, `${shortId}.meta.json`), JSON.stringify(meta));
    fs.writeFileSync(path.join(outDir, `${shortId}.facets.json`), JSON.stringify(buildFacets(books)));

    index.push({ id: srcId, shortId, title, author, totalPassages, totalCitations });
  }

  // Sort index by citation count (desc) so the home page leads with the richest.
  index.sort((a, b) => b.totalCitations - a.totalCitations);
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 2));

  const total = index.reduce((s, e) => s + e.totalCitations, 0);
  console.log(`[${direction}] Wrote ${index.length} works (${total} citations) + index.json to ${outDir}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Loading ${INPUT} ...`);
  const raw = fs.readFileSync(INPUT, "utf-8");
  const citationIndex: Record<string, Entry> = JSON.parse(raw);
  console.log(`Loaded ${Object.keys(citationIndex).length} entries`);

  emitIndex(citationIndex, "forward");
  emitIndex(reverseIndex(citationIndex), "reverse");
}

main();

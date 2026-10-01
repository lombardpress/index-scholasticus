# SCTA Citation Index (scta-index-scholasticus)

A statically-generated Next.js app that renders the SCTA citation index — for each
cited *source* (Bible, Lombard's *Sententiae*, Augustine, etc.) it shows which
passages are cited and, for each passage, which scholastic authors/works cite it.
It also runs the other way: for each *citing* work (Summa Halensis, Aquinas'
*Scriptum*, …) it shows each of its paragraphs and the passages that paragraph cites.

It reproduces the views of `scta-scikit/examples/citation_list_to_html.py` as a
fast, pre-rendered site.

## Architecture

- **Data pipeline** (`scripts/build-citation-data.ts`): a Node/TS port of the
  Python transform. Reads the full `citation_index.json` (~110 MB), groups
  entries by top-level source, builds the nested tries, and emits per-source data
  into `app/data/citations/` (git-ignored build artifact):
  - TODO: note that citation_index.json still has to be updated and manually triggered in scta-scikit before the rest of this app will update.
  - `index.json` — every source + totals (home page).
  - `<source>.meta.json` — source title, totals, and its book list (sidebar/TOC).
  - `<source>/<book>.html` — a pre-rendered, compact HTML fragment **per book**.
- **Reverse index** (`app/data/cites/`, same file layout): `reverseIndex()` flips
  every edge, keying entries by citing paragraph (its own ancestor chain becomes
  the trie path) with the passages it cites as children. The flipped data has the
  same shape, so it goes through the same `buildSource` → `renderBook` pipeline.
  In the reverse tree the "author" level is the cited source and the "work" level
  is the cited book. Each fragment carries `data-direction="forward|reverse"`.
  - Each direction drops edges whose *own* key side has fewer than two ancestors,
    so the totals differ a little (forward ≈ 50.2k, reverse ≈ 52.7k citations).
  - Coverage follows encoding. A work shows up as "citing" only once its own
    quotations are encoded; e.g. Augustine's *De Trinitate* is cited about 2.4k
    times but currently cites only 10 passages.
- **Pages** (App Router, `output: 'export'`). Both directions share the views
  in `app/components/views.tsx` and the data readers in `app/components/data.ts`:
  - `/` — list of all cited sources; `/cites` — list of all citing works (tabs).
  - `/source/[source]` and `/cites/[work]` — overview: sidebar + book table of
    contents. A work that appears in both indexes links across to its other view.
  - `/source/[source]/[book]` and `/cites/[work]/[book]` — one book's tree; the
    pre-rendered fragment is injected via `dangerouslySetInnerHTML`.
- **Why per-book pages?** The corpus grows (Bible verses expected to reach 100k+).
  One page per book keeps every page small and pre-baked (no async fetch, no
  client-side rendering needed) no matter how large the whole corpus becomes.
- **Interactivity** (`app/components/`): all collapse/expand is one delegated
  click handler (`CitationInteractions`) toggling a `.open` class — the tree
  itself is static HTML. `Sidebar` (book nav + filter) and `ThemeToggle` are the
  only other client components. Styling is the ported design in `app/globals.css`.
- **Text comparison** (`CompareModal`): clicking a citation (a `.para-uri`) opens
  a modal that shows the citing text alongside the cited source text, with n-gram
  diff highlighting. It resolves both expression URIs to canonical transcription
  URIs via a browser SPARQL query (`app/components/scta.ts`, endpoint
  `sparql.scta.info`, chain `hasCanonicalManifestation → hasCanonicalTranscription`)
  and renders `lbp-components`' `TextView` (which fetches text from
  `exist.scta.info/.../csv-pct.xq`). `TextView` is loaded via `next/dynamic`
  (`ssr:false`) into a lazy chunk, so it never runs during the static export and
  doesn't weigh down initial page load. The cited passage's URI is baked into each
  `.verse-row` as `data-source-id` by the build script.
- **Viewer links** (`ExtLink`): every source verse and every citing id carries a
  small external-link icon to `https://scta.lombardpress.org/res?resourceid=<uri>`,
  opening that passage in the SCTA viewer in context. The icon appears both in the
  tree (baked into the fragment by the build script) and in the comparison modal.
- **Citation filter** (`CitationFilter`): a sticky bar at the top of each book page
  filters the tree in place by the citing text's **author** and/or **work title**
  (separate fields, each matched as a whole contiguous substring, e.g.
  "Distinctio 2"). A verse is kept only if it still has a
  matching citation; matching branches are auto-expanded and a passage count is
  shown. It's pure client-side DOM filtering over the injected `#citation-tree`, so
  it needs no extra data (largest book ≈ 2,350 work-groups — trivial to filter).

## Local dependency: lbp-components (npm link)

`TextView` comes from the sibling component library `lbp-components`, consumed via
`npm link` (it is intentionally **not** listed in `package.json`). Set it up once:

```bash
# 1. register the global link (from the built dist)
cd ~/Projects/lombardpress/lbp-components/dist && npm link
# 2. link it into this app
cd ~/Projects/scta/scta-index-scholasticus && npm link lbp-components
```

Its runtime dependencies (react-bootstrap, swr, ngram-diff, react-tooltip, …)
resolve through the symlink from that repo's own `node_modules`, so the
`~/Projects/lombardpress/lbp-components` checkout must be present with its
dependencies installed (same arrangement as the `reader` app).

**Note:** because the link isn't tracked in `package.json`, a plain `npm install`
can prune it — re-run `npm link lbp-components` afterward if the import stops
resolving.

## Commands

```bash
npm install

# Regenerate the data (defaults to ../scta-scikit/examples/citation_index.json;
# override with an arg or the CITATION_INDEX env var). Needs a large heap.
npm run build:data

# Dev server
npm run dev

# Full static export (runs build:data then next build → ./out)
npm run build

# Deploy the exported site
npm run sync
```

The `build:data` step reads a ~110 MB JSON, so it runs under
`NODE_OPTIONS=--max-old-space-size=8192` (already set in the npm script).

# SCTA Citation Index (scta-index-scholasticus)

A statically-generated Next.js app that renders the SCTA citation index — for each
cited *source* (Bible, Lombard's *Sententiae*, Augustine, etc.) it shows which
passages are cited and, for each passage, which scholastic authors/works cite it.

It reproduces the views of `scta-scikit/examples/citation_list_to_html.py` as a
fast, pre-rendered site.

## Architecture

- **Data pipeline** (`scripts/build-citation-data.ts`): a Node/TS port of the
  Python transform. Reads the full `citation_index.json` (~110 MB), groups
  entries by top-level source, builds the nested tries, and emits per-source data
  into `app/data/citations/` (git-ignored build artifact):
  - `index.json` — every source + totals (home page).
  - `<source>.meta.json` — source title, totals, and its book list (sidebar/TOC).
  - `<source>/<book>.html` — a pre-rendered, compact HTML fragment **per book**.
- **Pages** (App Router, `output: 'export'`):
  - `/` — list of all sources.
  - `/source/[source]` — source overview: sidebar + book table of contents.
  - `/source/[source]/[book]` — one book's citations; the pre-rendered fragment is
    injected via `dangerouslySetInnerHTML`.
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

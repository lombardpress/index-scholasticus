// Page bodies shared by both directions of the index. The /source routes
// (cited source → citing texts) and the /cites routes (citing work → cited
// passages) render the same views over different data directories.

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "./Sidebar";
import CitationInteractions from "./CitationInteractions";
import CitationFilter from "./CitationFilter";
import SourceGrid from "./SourceGrid";
import BookToc from "./BookToc";
import { WORDING } from "./wording";
import PageHeader from "./PageHeader";
import {
  DIRECTIONS,
  getBookFragment,
  getFacets,
  getIndex,
  getMeta,
  other,
  type Direction,
} from "./data";

const COPY: Record<Direction, { tab: string }> = {
  forward: { tab: "Cited sources" },
  reverse: { tab: "Citing works" },
};

export function HomeView({ direction }: { direction: Direction }) {
  const sources = getIndex(direction);
  const totalPassages = sources.reduce((s, e) => s + e.totalPassages, 0);
  const totalCitations = sources.reduce((s, e) => s + e.totalCitations, 0);
  const { basePath } = DIRECTIONS[direction];
  const noun = direction === "forward" ? "sources" : "works";

  return (
    <main className="home">
      <div className="home-inner">
        <div className="home-header">
          <h1>Index Scholasticus</h1>
          <p className="home-tagline">A citation index for the SCTA Scholastic Corpus</p>
          <div className="site-credits">
            <a className="credit" href="https://lombardpress.org" target="_blank" rel="noopener">
              A LombardPress Publication
            </a>
            <span className="site-credits-sep">·</span>
            <a className="credit" href="https://scta.info" target="_blank" rel="noopener">
              Powered by SCTA Data
            </a>
          </div>
        </div>
        <nav className="home-tabs" aria-label="Index direction">
          {(["forward", "reverse"] as Direction[]).map((d) => (
            <Link
              key={d}
              href={d === "forward" ? "/" : "/cites"}
              className={"home-tab" + (d === direction ? " active" : "")}
              aria-current={d === direction ? "page" : undefined}
            >
              {COPY[d].tab}
            </Link>
          ))}
        </nav>
        <div className="home-stats">
          {sources.length.toLocaleString()} {noun} · {WORDING[direction].homeTimes(totalCitations)} ·{" "}
          {WORDING[direction].units(totalPassages)}
        </div>
        <SourceGrid direction={direction} sources={sources} basePath={basePath} noun={noun} />
      </div>
    </main>
  );
}

const n = (v: number, unit: string) => `${v.toLocaleString()} ${unit}${v !== 1 ? "s" : ""}`;

export function WorkOverview({ direction, work }: { direction: Direction; work: string }) {
  const meta = getMeta(direction, work);
  if (!meta) notFound();
  const { basePath } = DIRECTIONS[direction];

  // A work that is both cited and citing links across to its other view.
  const otherDir = other(direction);
  const otherMeta = getMeta(otherDir, work);

  return (
    <>
      <Sidebar
        direction={direction}
        basePath={basePath}
        sourceShortId={meta.shortId}
        sourceTitle={meta.title}
        books={meta.books}
        totalPassages={meta.totalPassages}
        totalCitations={meta.totalCitations}
      />
      <main id="main">
        <PageHeader
          title={meta.title}
          stats={[
            meta.author,
            COPY[direction].tab,
            n(meta.books.length, "book"),
            WORDING[direction].timesLower(meta.totalCitations),
            WORDING[direction].units(meta.totalPassages),
          ]}
        >
          {otherMeta && (
            <div className="page-cross">
              <Link href={`${DIRECTIONS[otherDir].basePath}/${work}/`}>
                {WORDING[otherDir].times(otherMeta.totalCitations)} →
              </Link>
            </div>
          )}
        </PageHeader>
        <BookToc
          direction={direction}
          bookBase={`${basePath}/${meta.shortId}`}
          books={meta.books}
          facets={getFacets(direction, work)}
        />
      </main>
    </>
  );
}

export function BookView({
  direction,
  work,
  book,
}: {
  direction: Direction;
  work: string;
  book: string;
}) {
  const meta = getMeta(direction, work);
  const fragment = getBookFragment(direction, work, book);
  const bookMeta = meta?.books.find((b) => b.slug === book);
  if (!meta || !bookMeta || fragment === null) notFound();
  const { basePath } = DIRECTIONS[direction];

  return (
    <>
      <Sidebar
        direction={direction}
        basePath={basePath}
        sourceShortId={meta.shortId}
        sourceTitle={meta.title}
        books={meta.books}
        totalPassages={meta.totalPassages}
        totalCitations={meta.totalCitations}
        activeBookSlug={book}
      />
      <main id="main">
        <PageHeader
          crumb={{ href: `${basePath}/${meta.shortId}/`, label: meta.title }}
          title={bookMeta.title}
          stats={[
            meta.author,
            COPY[direction].tab,
            WORDING[direction].timesLower(bookMeta.total),
            WORDING[direction].units(bookMeta.passages),
          ]}
        />
        <CitationFilter targetId="citation-tree" direction={direction} />
        <div id="citation-tree" dangerouslySetInnerHTML={{ __html: fragment }} />
      </main>
      <CitationInteractions targetId="citation-tree" />
    </>
  );
}

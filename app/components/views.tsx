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
import {
  DIRECTIONS,
  getBookFragment,
  getFacets,
  getIndex,
  getMeta,
  other,
  type Direction,
} from "./data";

const COPY: Record<Direction, { tab: string; crossLink: string }> = {
  forward: { tab: "Cited sources", crossLink: "Cited by" },
  reverse: { tab: "Citing works", crossLink: "Cites" },
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
          {sources.length.toLocaleString()} {noun} ·{" "}
          {totalPassages.toLocaleString()} passages ·{" "}
          {totalCitations.toLocaleString()} citations
        </div>
        <SourceGrid sources={sources} basePath={basePath} noun={noun} />
      </div>
    </main>
  );
}

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
        basePath={basePath}
        sourceShortId={meta.shortId}
        sourceTitle={meta.title}
        books={meta.books}
        totalPassages={meta.totalPassages}
        totalCitations={meta.totalCitations}
      />
      <main id="main">
        <div className="source-overview">
          <div className="overview-header">
            <h2>{meta.title}</h2>
          </div>
          <div className="overview-sub">
            {meta.author && <>{meta.author} · </>}
            {COPY[direction].tab} · {meta.books.length.toLocaleString()} books ·{" "}
            {meta.totalPassages.toLocaleString()} passages ·{" "}
            {meta.totalCitations.toLocaleString()} citations
          </div>
          {otherMeta && (
            <div className="overview-cross">
              <Link href={`${DIRECTIONS[otherDir].basePath}/${work}`}>
                {COPY[otherDir].crossLink} {otherMeta.totalCitations.toLocaleString()} citations →
              </Link>
            </div>
          )}
          <BookToc
            direction={direction}
            bookBase={`${basePath}/${meta.shortId}`}
            books={meta.books}
            facets={getFacets(direction, work)}
          />
        </div>
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
  if (!meta || fragment === null) notFound();

  return (
    <>
      <Sidebar
        basePath={DIRECTIONS[direction].basePath}
        sourceShortId={meta.shortId}
        sourceTitle={meta.title}
        books={meta.books}
        totalPassages={meta.totalPassages}
        totalCitations={meta.totalCitations}
        activeBookSlug={book}
      />
      <main id="main">
        <CitationFilter targetId="citation-tree" direction={direction} />
        <div id="citation-tree" dangerouslySetInnerHTML={{ __html: fragment }} />
      </main>
      <CitationInteractions targetId="citation-tree" />
    </>
  );
}

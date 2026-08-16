import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import type { SourceMeta } from "../../components/types";

interface PageProps {
  params: Promise<{ source: string }>;
}

const CITATIONS_DIR = path.join(process.cwd(), "app", "data", "citations");

function getMeta(source: string): SourceMeta | null {
  try {
    const p = path.join(CITATIONS_DIR, `${source}.meta.json`);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  try {
    return fs
      .readdirSync(CITATIONS_DIR)
      .filter((name) => name.endsWith(".meta.json"))
      .map((name) => ({ source: name.replace(/\.meta\.json$/, "") }));
  } catch {
    return [];
  }
}

export default async function SourceOverview({ params }: PageProps) {
  const { source } = await params;
  const meta = getMeta(source);
  if (!meta) notFound();

  return (
    <>
      <Sidebar
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
            {meta.books.length.toLocaleString()} books ·{" "}
            {meta.totalPassages.toLocaleString()} passages ·{" "}
            {meta.totalCitations.toLocaleString()} citations
          </div>
          <div className="book-toc">
            {meta.books.map((b) => (
              <Link key={b.slug} href={`/source/${meta.shortId}/${b.slug}`}>
                <span className="toc-title">{b.title}</span>
                <span className="toc-count">{b.total.toLocaleString()}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

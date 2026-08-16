import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import Sidebar from "../../../components/Sidebar";
import CitationInteractions from "../../../components/CitationInteractions";
import CitationFilter from "../../../components/CitationFilter";
import type { SourceMeta } from "../../../components/types";

interface PageProps {
  params: Promise<{ source: string; book: string }>;
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

function getBookFragment(source: string, book: string): string | null {
  try {
    const p = path.join(CITATIONS_DIR, source, `${book}.html`);
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  try {
    const metas = fs
      .readdirSync(CITATIONS_DIR)
      .filter((name) => name.endsWith(".meta.json"));
    const params: { source: string; book: string }[] = [];
    for (const name of metas) {
      const meta: SourceMeta = JSON.parse(
        fs.readFileSync(path.join(CITATIONS_DIR, name), "utf-8")
      );
      for (const b of meta.books) {
        params.push({ source: meta.shortId, book: b.slug });
      }
    }
    return params;
  } catch {
    return [];
  }
}

export default async function BookPage({ params }: PageProps) {
  const { source, book } = await params;
  const meta = getMeta(source);
  const fragment = getBookFragment(source, book);
  if (!meta || fragment === null) notFound();

  return (
    <>
      <Sidebar
        sourceShortId={meta.shortId}
        sourceTitle={meta.title}
        books={meta.books}
        totalPassages={meta.totalPassages}
        totalCitations={meta.totalCitations}
        activeBookSlug={book}
      />
      <main id="main">
        <CitationFilter targetId="citation-tree" />
        <div id="citation-tree" dangerouslySetInnerHTML={{ __html: fragment }} />
      </main>
      <CitationInteractions targetId="citation-tree" />
    </>
  );
}

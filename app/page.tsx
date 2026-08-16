import fs from "fs";
import path from "path";
import Link from "next/link";
import type { SourceIndexEntry } from "./components/types";

function getIndex(): SourceIndexEntry[] {
  try {
    const p = path.join(process.cwd(), "app", "data", "citations", "index.json");
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return [];
  }
}

export default function Home() {
  const sources = getIndex();
  const totalPassages = sources.reduce((s, e) => s + e.totalPassages, 0);
  const totalCitations = sources.reduce((s, e) => s + e.totalCitations, 0);

  return (
    <main className="home">
      <div className="home-inner">
        <div className="home-header">
          <h1>Citation Index</h1>
          <p>SCTA Scholastic Corpus — browse which passages cite which source.</p>
        </div>
        <div className="home-stats">
          {sources.length.toLocaleString()} sources ·{" "}
          {totalPassages.toLocaleString()} passages ·{" "}
          {totalCitations.toLocaleString()} citations
        </div>
        <div className="source-grid">
          {sources.map((s) => (
            <Link key={s.shortId} href={`/source/${s.shortId}`} className="source-card">
              <div className="source-title">{s.title}</div>
              <div className="source-short">{s.shortId}</div>
              <div className="source-counts">
                <span>
                  <b>{s.totalCitations.toLocaleString()}</b> citations
                </span>
                <span>
                  <b>{s.totalPassages.toLocaleString()}</b> passages
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

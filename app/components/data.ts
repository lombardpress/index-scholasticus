// Server-only readers for the build artifacts in app/data/. The same shapes are
// emitted in two directions (see scripts/build-citation-data.ts):
//  - "forward": cited source → passage → citing texts   (app/data/citations, /source)
//  - "reverse": citing work → paragraph → cited passages (app/data/cites,     /cites)

import fs from "fs";
import path from "path";
import type { SourceIndexEntry, SourceMeta } from "./types";

export type Direction = "forward" | "reverse";

const DATA_DIR = path.join(process.cwd(), "app", "data");

export const DIRECTIONS: Record<Direction, { dir: string; basePath: string }> = {
  forward: { dir: path.join(DATA_DIR, "citations"), basePath: "/source" },
  reverse: { dir: path.join(DATA_DIR, "cites"), basePath: "/cites" },
};

export function other(direction: Direction): Direction {
  return direction === "forward" ? "reverse" : "forward";
}

export function getIndex(direction: Direction): SourceIndexEntry[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIRECTIONS[direction].dir, "index.json"), "utf-8"));
  } catch {
    return [];
  }
}

export function getMeta(direction: Direction, work: string): SourceMeta | null {
  try {
    const p = path.join(DIRECTIONS[direction].dir, `${work}.meta.json`);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export function getBookFragment(direction: Direction, work: string, book: string): string | null {
  try {
    const p = path.join(DIRECTIONS[direction].dir, work, `${book}.html`);
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

function metaNames(direction: Direction): string[] {
  try {
    return fs.readdirSync(DIRECTIONS[direction].dir).filter((n) => n.endsWith(".meta.json"));
  } catch {
    return [];
  }
}

export function workShortIds(direction: Direction): string[] {
  return metaNames(direction).map((n) => n.replace(/\.meta\.json$/, ""));
}

export function bookParams(direction: Direction): { work: string; book: string }[] {
  const params: { work: string; book: string }[] = [];
  for (const name of metaNames(direction)) {
    const meta: SourceMeta = JSON.parse(
      fs.readFileSync(path.join(DIRECTIONS[direction].dir, name), "utf-8")
    );
    for (const b of meta.books) params.push({ work: meta.shortId, book: b.slug });
  }
  return params;
}

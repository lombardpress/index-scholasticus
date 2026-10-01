// All count phrasing in one place, so the two directions of the index read
// distinctly: cited sources are passive ("Cited 42,585 times · 10,526 passages
// cited"), citing works are active ("Cites 5,180 times · from 3,918
// paragraphs"). In the reverse index the second count is citing paragraphs.

export type Direction = "forward" | "reverse";

const fmt = (n: number) => n.toLocaleString();
const s = (n: number, word: string) => `${word}${n !== 1 ? "s" : ""}`;

export const WORDING = {
  forward: {
    times: (n: number) => `Cited ${fmt(n)} ${s(n, "time")}`,
    units: (n: number) => `${fmt(n)} ${s(n, "passage")} cited`,
    // Lowercase/plural-verb forms for mid-sentence use
    timesLower: (n: number) => `cited ${fmt(n)} ${s(n, "time")}`,
    homeTimes: (n: number) => `cited ${fmt(n)} ${s(n, "time")}`,
    unitCount: (n: number) => `${fmt(n)} ${s(n, "passage")}`,
    filterStatus: (n: number, books: number) =>
      `cited ${fmt(n)} ${s(n, "time")} in ${books} ${s(books, "book")}`,
  },
  reverse: {
    times: (n: number) => `Cites ${fmt(n)} ${s(n, "time")}`,
    units: (n: number) => `from ${fmt(n)} ${s(n, "paragraph")}`,
    timesLower: (n: number) => `cites ${fmt(n)} ${s(n, "time")}`,
    homeTimes: (n: number) => `cite ${fmt(n)} ${s(n, "time")}`,
    unitCount: (n: number) => `${fmt(n)} ${s(n, "paragraph")}`,
    filterStatus: (n: number, books: number) =>
      `cites ${fmt(n)} ${s(n, "time")} in ${books} ${s(books, "book")}`,
  },
} satisfies Record<Direction, Record<string, (...a: number[]) => string>>;

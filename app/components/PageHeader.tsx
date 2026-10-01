import Link from "next/link";
import type { ReactNode } from "react";

// Title block shared by the overview and book pages, so both read the same way
// at their own scope: "Bible / Cited sources · 72 books · …" on the overview,
// "Bible › / Biblia, Genesis / Cited sources · 338 passages · …" in a book.

export default function PageHeader({
  crumb,
  title,
  stats,
  children,
}: {
  crumb?: { href: string; label: string };
  title: string;
  stats: (string | null | undefined | false)[];
  children?: ReactNode; // extra line under the stats (e.g. the cross-link)
}) {
  return (
    <header className="page-header">
      {crumb && (
        <div className="page-crumb">
          <Link href={crumb.href}>{crumb.label}</Link> ›
        </div>
      )}
      <h2>{title}</h2>
      <div className="page-stats">{stats.filter(Boolean).join(" · ")}</div>
      {children}
    </header>
  );
}

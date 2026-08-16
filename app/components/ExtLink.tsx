// External-link icon that jumps to the SCTA viewer for a given resource id.
// Used in the comparison modal; the citation tree (static HTML) embeds the same
// icon markup directly in the build script.

export const VIEWER_BASE = "https://scta.lombardpress.org/res?resourceid=";

export function ExtLink({
  resourceId,
  title = "Open in SCTA viewer",
}: {
  resourceId: string;
  title?: string;
}) {
  return (
    <a
      className="ext-link"
      href={`${VIEWER_BASE}${resourceId}`}
      target="_blank"
      rel="noopener"
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        viewBox="0 0 24 24"
        width="11"
        height="11"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

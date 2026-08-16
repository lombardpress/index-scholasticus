"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { resolveTranscription } from "./scta";
import { ExtLink } from "./ExtLink";

// lbp-components is a client-only library; load TextView dynamically (ssr:false)
// so it never runs during the static export, mirroring the reader app.
const TextView = dynamic(() => import("lbp-components").then((m) => m.TextView), {
  ssr: false,
  loading: () => <p className="cmp-loading">Loading text…</p>,
});

export interface CompareTarget {
  quoteId: string; // citing-text expression URI (the para-uri href)
  sourceId: string; // cited passage URI (from the verse-row)
  sourceLabel: string;
}

type Status = "resolving" | "ready" | "error";

export default function CompareModal({
  target,
  onClose,
}: {
  target: CompareTarget;
  onClose: () => void;
}) {
  const { quoteId, sourceId, sourceLabel } = target;
  const [startT, setStartT] = useState<string | null>(null);
  const [sourceT, setSourceT] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("resolving");
  const [quoteText, setQuoteText] = useState("");
  const [sourceText, setSourceText] = useState("");

  // Resolve both expression URIs to transcription URIs whenever the target changes.
  useEffect(() => {
    let cancelled = false;
    setStatus("resolving");
    setStartT(null);
    setSourceT(null);
    setQuoteText("");
    setSourceText("");
    Promise.all([resolveTranscription(quoteId), resolveTranscription(sourceId)])
      .then(([q, s]) => {
        if (cancelled) return;
        setStartT(q);
        setSourceT(s);
        setStatus(q ? "ready" : "error");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId, sourceId]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const quoteShort = quoteId.split("/resource/")[1] || quoteId;

  return (
    <div className="cmp-overlay" onClick={onClose}>
      <div className="cmp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cmp-header">
          <div className="cmp-title">
            Text comparison
            <span className="cmp-source"> · source {sourceLabel}</span>
          </div>
          <button className="cmp-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {status === "resolving" && (
          <div className="cmp-status">Resolving transcriptions…</div>
        )}
        {status === "error" && !startT && (
          <div className="cmp-status">
            No transcription is available for this citing text.
          </div>
        )}

        {startT && (
          <div className="cmp-body">
            <div className="cmp-col">
              <h4 className="cmp-col-title">Citing text</h4>
              <div className="cmp-uri">
                <span className="cmp-uri-text">{quoteShort}</span>
                <ExtLink resourceId={quoteId} title="Open citing text in SCTA viewer" />
              </div>
              <TextView
              compareText={sourceText}
                tresourceid={startT}
                hideCitation={true}
                handleTextReceive={setQuoteText}
              />
            </div>
            <div className="cmp-col">
              <h4 className="cmp-col-title">Source text</h4>
              <div className="cmp-uri">
                <span className="cmp-uri-text">
                  {sourceId.split("/resource/")[1] || sourceId}
                </span>
                <ExtLink resourceId={sourceId} title="Open source passage in SCTA viewer" />
              </div>
              {sourceT ? (
                quoteText ? (
                  <TextView
                    compareText={quoteText}
                    compareTresourceid={startT}
                    tresourceid={sourceT}
                    hideCitation={true}
                    handleTextReceive={setSourceText}
                  />
                ) : (
                  <p className="cmp-loading">Loading source comparison…</p>
                )
              ) : (
                <p className="cmp-status">
                  No transcription available for the source passage.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

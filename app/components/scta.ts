// Client-side helpers for talking to the SCTA triplestore.

const SPARQL_ENDPOINT = "https://sparql.scta.info/ds/query";

// Resolve an SCTA resource (expression) URI to its canonical transcription URI,
// following hasCanonicalManifestation -> hasCanonicalTranscription. The
// transcription URI is what lbp-components' TextView expects as `tresourceid`.
// Returns null when the chain isn't registered (e.g. no transcription exists).
export async function resolveTranscription(resourceUri: string): Promise<string | null> {
  const query = `PREFIX scta: <http://scta.info/property/>
SELECT ?transcription WHERE {
  <${resourceUri}> scta:hasCanonicalManifestation ?m .
  ?m scta:hasCanonicalTranscription ?transcription .
} LIMIT 1`;

  try {
    const res = await fetch(`${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/sparql-results+json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const bindings = json?.results?.bindings ?? [];
    return bindings.length ? bindings[0].transcription.value : null;
  } catch {
    return null;
  }
}

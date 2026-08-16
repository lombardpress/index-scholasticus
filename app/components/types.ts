// Shapes emitted by scripts/build-citation-data.ts and consumed by the
// server renderers + client components.

export interface CiteTrieNode {
  label: string;
  paras: { uri: string }[];
  children: CiteTrieNode[];
}

export interface Work {
  title: string;
  count: number;
  paras: { uri: string }[];
  children: CiteTrieNode[];
}

export interface Group {
  author: string;
  count: number;
  works: Work[];
}

export interface Leaf {
  id: string;
  shortId: string;
  verseNum: string;
  order: number;
  citeCount: number;
  groups: Group[];
}

export interface CitationTrieNode {
  label: string;
  order: number;
  paras: Leaf[];
  children: CitationTrieNode[];
}

export interface Book extends Omit<CitationTrieNode, "label"> {
  id: string;
  title: string;
}

export interface SourceIndexEntry {
  id: string;
  shortId: string;
  title: string;
  totalPassages: number;
  totalCitations: number;
}

export interface BookMeta {
  slug: string;
  id: string;
  title: string;
  total: number;
}

export interface SourceMeta extends SourceIndexEntry {
  books: BookMeta[];
}

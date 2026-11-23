export interface SearchHit {
  title: string;
  url: string;
  snippet?: string;
}

export interface SearchResult {
  hits: SearchHit[];
  source: string; // penyedia yang memberi hasil: "duckduckgo" atau "wikipedia"
}

// Real connection status for each data source, derived from which env keys are
// actually set (server-side). No mock — reflects the live configuration.

export type SourceStatus = {
  name: string
  kind: string
  status: "Connected" | "Not set" | "Limited"
  detail: string
}

function has(name: string): boolean {
  return !!process.env[name]
}

export function getSourceStatuses(): SourceStatus[] {
  const youtube = has("YOUTUBE_API_KEY")
  const spotify = has("SPOTIFY_CLIENT_ID") && has("SPOTIFY_CLIENT_SECRET")
  const openai = has("OPENAI_API_KEY")
  const apify = has("APIFY_TOKEN")
  const sportradar = has("SPORTRADAR_CRICKET_API_KEY")

  return [
    {
      name: "YouTube Data API",
      kind: "Music discovery",
      status: youtube ? "Connected" : "Not set",
      detail: youtube ? "mostPopular · region IN · category Music" : "Set YOUTUBE_API_KEY to enable",
    },
    {
      name: "Spotify",
      kind: "Music discovery",
      status: spotify ? "Limited" : "Not set",
      detail: spotify
        ? "Search API (dev mode — popularity & browse charts unavailable)"
        : "Set SPOTIFY_CLIENT_ID / SECRET to enable",
    },
    {
      name: "OpenAI",
      kind: "Scoring + copy",
      status: openai ? "Connected" : "Not set",
      detail: openai ? "Relevance + brand-safety scoring, Pulse, chat" : "Set OPENAI_API_KEY to enable",
    },
    {
      name: "Apify",
      kind: "Instagram discovery",
      status: apify ? "Connected" : "Not set",
      detail: apify
        ? "Instagram Hashtag Scraper → scan candidates (cached 6h)"
        : "Set APIFY_TOKEN to enable",
    },
    {
      name: "Sportradar Cricket",
      kind: "Match-night fixtures",
      status: sportradar ? "Connected" : "Not set",
      detail: sportradar
        ? "Upcoming fixtures feed the Pulse match-night brief (cached 12h)"
        : "Set SPORTRADAR_CRICKET_API_KEY to enable",
    },
  ]
}

// The creators Anya benchmarks against. Real config (not fetched data); editable
// persistence can come with the DB later.
export const WATCHLIST = [
  { handle: "@kayan.a", name: "Kayan / Ambika Nayak", note: "Mumbai producer-DJ + fashion", followers: "—" },
  { handle: "@dj_rihya", name: "DJ Rihya", note: "Mass Indian crowd energy", followers: "2M" },
  { handle: "@jyoty", name: "Jyoty", note: "South Asian global tastemaker", followers: "—" },
  { handle: "@peggygou_", name: "Peggy Gou", note: "Fashion-led global music identity", followers: "—" },
  { handle: "@naina_avtr", name: "Naina Avtr", note: "Indian AI creator benchmark", followers: "380K" },
  { handle: "@kyraonig", name: "Kyra", note: "Premium Mumbai AI lifestyle", followers: "235K" },
]

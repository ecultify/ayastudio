// Server-only typed access to environment variables.
// Getters throw lazily so a single missing key only fails the source that
// needs it (the scan orchestrator catches per-source errors).

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

export const env = {
  openaiKey: () => required("OPENAI_API_KEY"),
  openaiModel: () => process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  youtubeKey: () => required("YOUTUBE_API_KEY"),
  spotifyId: () => required("SPOTIFY_CLIENT_ID"),
  spotifySecret: () => required("SPOTIFY_CLIENT_SECRET"),
  apifyToken: () => process.env.APIFY_TOKEN, // optional for now
}

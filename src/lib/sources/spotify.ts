import { env } from "@/lib/env"
import type { Candidate } from "@/lib/scan/types"

// Cache the client-credentials token in module memory until it expires.
let token: { value: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value

  const basic = Buffer.from(`${env.spotifyId()}:${env.spotifySecret()}`).toString("base64")
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Spotify token ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 }
  return token.value
}

// Spotify deprecated /browse/new-releases for client-credentials apps (403), and
// development-mode apps don't get the `popularity` field — but /search works and
// returns album.release_date. These seeds map to Anya's content pillars; results
// are ordered by recency (most recently released first).
const SEED_QUERIES = ["bollywood", "punjabi", "indie india", "desi hip hop", "afro house", "amapiano"]

type SpotifyTrack = {
  id: string
  name: string
  artists?: { name: string }[]
  external_urls?: { spotify?: string }
  album?: { release_date?: string; release_date_precision?: string }
}

/** Discover recent tracks across Anya's scenes via Spotify search. */
export async function fetchSpotifyTrending(): Promise<Candidate[]> {
  const t = await getToken()

  const results = await Promise.all(
    SEED_QUERIES.map(async (q) => {
      const url = new URL("https://api.spotify.com/v1/search")
      url.searchParams.set("q", q)
      url.searchParams.set("type", "track")
      url.searchParams.set("market", "IN")
      url.searchParams.set("limit", "6")
      const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" })
      if (!res.ok) throw new Error(`Spotify search "${q}" ${res.status}: ${await res.text()}`)
      const data = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } }
      return data.tracks?.items ?? []
    }),
  )

  // Flatten, dedupe by track id, order by release recency.
  const byId = new Map<string, SpotifyTrack>()
  for (const track of results.flat()) {
    if (track?.id && !byId.has(track.id)) byId.set(track.id, track)
  }

  return [...byId.values()]
    .sort((a, b) => (b.album?.release_date ?? "").localeCompare(a.album?.release_date ?? ""))
    .slice(0, 15)
    .map((tr) => {
      const artists = (tr.artists ?? []).map((a) => a.name).join(", ")
      const released = tr.album?.release_date
      return {
        source: "Spotify" as const,
        platform: "Spotify" as const,
        title: artists ? `${artists} — ${tr.name}` : tr.name,
        subtitle: "Spotify",
        url: tr.external_urls?.spotify,
        metric: released ? `Released ${released}` : "Spotify · IN",
      }
    })
}

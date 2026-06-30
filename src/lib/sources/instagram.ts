import { env } from "@/lib/env"
import type { Candidate } from "@/lib/scan/types"

// Apify Instagram Hashtag Scraper. Surfaces recent reels/posts from Anya's
// scene-relevant hashtags as discovery candidates (visual + caption trends).
// The actor runs synchronously and Instagram scraping is slow + credit-costing,
// so results are cached in module memory for longer than the main scan TTL.

const ACTOR = "apify~instagram-hashtag-scraper"
const HASHTAGS = ["mumbaidj", "djlife", "bollywoodremix", "mumbainightlife"]
const RESULTS_LIMIT = 12 // per hashtag, capped by the actor
const RUN_TIMEOUT_MS = 75_000
const CACHE_TTL_MS = 1000 * 60 * 60 * 6 // 6h — protect Apify credits across refreshes

type ApifyPost = {
  url?: string
  caption?: string
  ownerUsername?: string
  likesCount?: number
  commentsCount?: number
  videoViewCount?: number
  videoPlayCount?: number
  type?: string // "Video" | "Image" | "Sidecar"
  productType?: string // "clips" for reels
  hashtags?: string[]
}

let cache: { value: Candidate[]; expiresAt: number } | null = null

function compact(n?: number): string | null {
  if (!Number.isFinite(n as number) || (n as number) <= 0) return null
  const v = n as number
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`
  return String(v)
}

/** Engagement metric line, preferring video views, then likes. */
function metricFor(p: ApifyPost): string {
  const views = compact(p.videoViewCount ?? p.videoPlayCount)
  if (views) return `${views} views`
  const likes = compact(p.likesCount)
  if (likes) return `${likes} likes`
  return "Instagram"
}

function engagement(p: ApifyPost): number {
  return (p.videoViewCount ?? p.videoPlayCount ?? 0) + (p.likesCount ?? 0) * 5 + (p.commentsCount ?? 0) * 20
}

function titleFor(p: ApifyPost): string {
  const caption = p.caption?.replace(/\s+/g, " ").trim()
  if (caption) return caption.length > 80 ? `${caption.slice(0, 77)}…` : caption
  return p.ownerUsername ? `@${p.ownerUsername} reel` : "Instagram reel"
}

/** Discover recent Instagram reels across Anya's hashtags via Apify. */
export async function fetchInstagramTrending(): Promise<Candidate[]> {
  const token = env.apifyToken()
  if (!token) return [] // not configured — silently skip
  if (cache && Date.now() < cache.expiresAt) return cache.value

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashtags: HASHTAGS, resultsLimit: RESULTS_LIMIT }),
        cache: "no-store",
        signal: controller.signal,
      },
    )
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Apify run timed out")
    throw e
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const items = (await res.json()) as ApifyPost[]

  const candidates = (Array.isArray(items) ? items : [])
    .filter((p) => p && p.url && (p.caption || p.ownerUsername))
    // Prefer reels/video — that's what the content engine plans around.
    .sort((a, b) => engagement(b) - engagement(a))
    .slice(0, 15)
    .map<Candidate>((p) => ({
      source: "Instagram",
      platform: "Instagram",
      title: titleFor(p),
      subtitle: p.ownerUsername ? `@${p.ownerUsername}` : "Instagram",
      url: p.url,
      metric: metricFor(p),
    }))

  cache = { value: candidates, expiresAt: Date.now() + CACHE_TTL_MS }
  return candidates
}

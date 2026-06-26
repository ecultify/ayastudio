import { env } from "@/lib/env"
import type { Candidate } from "@/lib/scan/types"

/** Format a raw YouTube view count into "2.1M views" / "640K views". */
function formatViews(raw?: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return "YouTube"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K views`
  return `${n} views`
}

type YouTubeItem = {
  id: string
  snippet?: { title?: string; channelTitle?: string; tags?: string[] }
  statistics?: { viewCount?: string }
}

/** Most-popular music videos in India (category 10 = Music). */
export async function fetchYouTubeTrending(): Promise<Candidate[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos")
  url.searchParams.set("part", "snippet,statistics")
  url.searchParams.set("chart", "mostPopular")
  url.searchParams.set("videoCategoryId", "10")
  url.searchParams.set("regionCode", "IN")
  url.searchParams.set("maxResults", "25")
  url.searchParams.set("key", env.youtubeKey())

  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`YouTube ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { items?: YouTubeItem[] }

  return (data.items ?? []).map((it) => ({
    source: "YouTube" as const,
    platform: "YouTube" as const,
    title: it.snippet?.title ?? "Untitled",
    subtitle: it.snippet?.channelTitle,
    url: `https://www.youtube.com/watch?v=${it.id}`,
    metric: formatViews(it.statistics?.viewCount),
  }))
}

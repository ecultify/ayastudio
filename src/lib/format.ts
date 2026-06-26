/** Format an ISO timestamp as e.g. "16 Jun 2026, 7:02 AM IST". */
export function formatIST(iso: string): string {
  const d = new Date(iso)
  const s = d.toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  return `${s} IST`
}

/** Whole days between an ISO timestamp and now (floored, min 0). */
export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

"use server"

import { revalidatePath } from "next/cache"
import { refreshScan, regeneratePulse } from "@/lib/scan/cache"

/** Re-run the full discovery + scoring + Pulse scan. */
export async function refreshScanAction(): Promise<void> {
  await refreshScan()
  revalidatePath("/dashboard")
}

/** Regenerate just the weekly Pulse from the current trend set. */
export async function newPulseAction(): Promise<void> {
  await regeneratePulse()
  revalidatePath("/dashboard")
}

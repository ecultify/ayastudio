"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { refreshScanAction, newPulseAction } from "@/app/(app)/dashboard/actions"

/** Header buttons: trigger a live re-scan or regenerate the Pulse. */
export function ScanActions() {
  const [pending, start] = useTransition()
  const router = useRouter()

  const run = (action: () => Promise<void>) =>
    start(async () => {
      await action()
      router.refresh()
    })

  return (
    <>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(refreshScanAction)}>
        <RefreshCw className={cn("size-4", pending && "animate-spin")} />
        {pending ? "Scanning…" : "Refresh scan"}
      </Button>
      <Button size="sm" disabled={pending} onClick={() => run(newPulseAction)}>
        <ArrowUpRight className="size-4" /> New Pulse
      </Button>
    </>
  )
}

/** Inline "Regenerate anyway" button used in the stale-Pulse banner. */
export function RegenerateButton() {
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <Button
      variant="outline"
      size="sm"
      className="bg-card"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await newPulseAction()
          router.refresh()
        })
      }
    >
      {pending ? "Regenerating…" : "Regenerate anyway"}
    </Button>
  )
}

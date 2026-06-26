"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Opens the browser print dialog (Save as PDF) for the current report. */
export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Download className="size-4" /> Export PDF
    </Button>
  )
}

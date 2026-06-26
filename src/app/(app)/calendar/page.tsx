import { PageHeader } from "@/components/page-header"
import { CalendarClient } from "@/components/calendar-client"

export default function CalendarPage() {
  return (
    <div className="flex h-full flex-col px-5 py-6 md:px-8">
      <PageHeader title="Calendar" subtitle="Plan posts across pillars. Drag to reschedule; generate a starter plan from live trends." />
      <div className="mt-5 min-h-0 flex-1">
        <CalendarClient />
      </div>
    </div>
  )
}

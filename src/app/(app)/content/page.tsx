import { PageHeader } from "@/components/page-header"
import { Page } from "@/components/page"
import { ContentEngine } from "@/components/content-engine"

export default function ContentPage() {
  return (
    <Page>
      <PageHeader title="Content Engine" subtitle="Turn this week's live trends into on-voice direction and copy." />
      <ContentEngine />
    </Page>
  )
}

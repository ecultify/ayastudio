import { PageHeader } from "@/components/page-header"
import { Page } from "@/components/page"
import { KnowledgeBase } from "@/components/knowledge-base"

export default function KnowledgePage() {
  return (
    <Page>
      <PageHeader title="Knowledge Base" subtitle="Upload references, briefs and inspiration. Anya's librarian categorises each file and rates how useful it is for her on upload." />
      <KnowledgeBase />
    </Page>
  )
}

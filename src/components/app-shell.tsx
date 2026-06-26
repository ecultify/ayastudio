import { AppSidebar } from "@/components/app-sidebar"
import { Topbar } from "@/components/topbar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

/** App frame built on the shadcn sidebar. Holds the collapse state via SidebarProvider. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-dvh min-h-0">
      <AppSidebar />
      <SidebarInset>
        <Topbar />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

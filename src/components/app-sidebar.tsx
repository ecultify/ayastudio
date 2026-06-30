"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, TrendingUp, FileText, Sparkles, CalendarDays, MessagesSquare, Settings, Radio, Library } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

const groups = [
  { label: "Intelligence", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/trends", label: "Trends", icon: TrendingUp },
    { href: "/reports", label: "Pulse Reports", icon: FileText },
  ]},
  { label: "Create", items: [
    { href: "/content", label: "Content Engine", icon: Sparkles },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/chat", label: "Ask Anya", icon: MessagesSquare },
  ]},
  { label: "Library", items: [
    { href: "/knowledge", label: "Knowledge Base", icon: Library },
  ]},
  { label: "System", items: [
    { href: "/settings", label: "Settings", icon: Settings },
  ]},
]

export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const collapsed = state === "collapsed"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-12 items-center gap-2.5 px-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <Radio className="size-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold">Anya Studio</div>
              <div className="text-muted-foreground text-[10px] tracking-wide uppercase">Culture Radar</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => {
                  const active = pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href))
                  const Icon = it.icon
                  return (
                    <SidebarMenuItem key={it.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={it.label}>
                        <Link href={it.href}>
                          <Icon />
                          <span>{it.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}

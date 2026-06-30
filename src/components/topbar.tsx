"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export function Topbar() {
  return (
    <header className="bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="text-muted-foreground -ml-1" />
      <Separator orientation="vertical" className="mr-1 hidden h-5 sm:block" />
      <div className="relative w-full max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input placeholder="Search trends, sounds, creators…" className="h-9 pl-9" />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Button size="sm" asChild><Link href="/reports">Generate report</Link></Button>
        <Avatar className="size-8 border">
          <AvatarFallback>AM</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

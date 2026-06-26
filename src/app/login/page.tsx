import Link from "next/link"
import { Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="bg-primary text-primary-foreground mb-4 flex size-11 items-center justify-center rounded-xl"><Radio className="size-5" /></div>
          <h1 className="font-serif text-2xl font-medium">Aya Studio</h1>
          <p className="text-muted-foreground mt-1 text-sm">Culture radar & content engine</p>
        </div>
        <div className="bg-card space-y-4 rounded-xl border p-6 shadow-xs">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Email</label>
            <Input type="email" placeholder="you@theqwertyink.com" />
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Password</label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full" asChild><Link href="/dashboard">Sign in</Link></Button>
          <div className="relative py-1 text-center">
            <span className="hairline absolute inset-x-0 top-1/2 h-px" />
            <span className="bg-card text-muted-foreground relative px-2 text-xs">or</span>
          </div>
          <Button variant="outline" className="w-full" asChild><Link href="/dashboard">Continue with Google</Link></Button>
        </div>
        <p className="text-muted-foreground mt-6 text-center text-xs">Restricted access · The Qwerty Ink × Parimatch</p>
      </div>
    </div>
  )
}

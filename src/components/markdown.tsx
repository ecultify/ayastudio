"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, Copy } from "lucide-react"

/** Renders assistant markdown. Fenced code blocks become isolated, copyable artifacts. */
export function Markdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-3">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          h1: ({ children }) => <h1 className="mt-4 mb-2 text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-4 mb-2 text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 mb-1.5 text-sm font-semibold">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-muted-foreground/30 text-muted-foreground my-3 border-l-2 pl-3">{children}</blockquote>
          ),
          hr: () => <hr className="my-4" />,
          // inline code (block code is intercepted by `pre` below)
          code: ({ children }) => (
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
          ),
          pre: ({ children }) => <Artifact>{children}</Artifact>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

/** Pulls the language + raw text out of a fenced block's <code> child and renders an artifact card. */
function Artifact({ children }: { children: React.ReactNode }) {
  const el = Array.isArray(children) ? children[0] : children
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = (el as any)?.props ?? {}
  const className: string = props.className || ""
  const match = /language-(\w+)/.exec(className)
  const lang = match?.[1]?.toLowerCase()
  const label = !lang || lang === "text" || lang === "plaintext" ? "Snippet" : lang
  const text = String(props.children ?? "").replace(/\n+$/, "")
  return <ArtifactCard label={label} text={text} />
}

function ArtifactCard({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="bg-card my-3 overflow-hidden rounded-lg border">
      <div className="bg-muted/50 flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</span>
        <button onClick={copy} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs">
          {copied ? (
            <>
              <Check className="size-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code className="font-mono whitespace-pre">{text}</code>
      </pre>
    </div>
  )
}

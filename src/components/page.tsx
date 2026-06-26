/**
 * Standard page wrapper: padded, max-width, scrolls within the fixed app frame.
 * Pages that want to be full-bleed (e.g. chat) render their own full-height
 * layout instead of using this.
 */
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl space-y-7 px-5 py-7 md:px-8">{children}</div>
    </div>
  )
}

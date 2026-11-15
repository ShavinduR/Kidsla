const YEAR = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="border-t border-sand bg-sand/50">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-12 text-center sm:px-6 lg:px-8">
        <p className="text-2xl font-bold tracking-[0.25em]">KIDSLA</p>
        <p className="max-w-xs text-sm text-ink-soft">Soft essentials for little adventures.</p>
        <p className="mt-4 text-xs text-ink-soft/80">© {YEAR} KIDSLA. All rights reserved.</p>
      </div>
    </footer>
  )
}

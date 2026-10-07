interface PageStubProps {
  title: string
  description?: string
}

export function PageStub({ title, description }: PageStubProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="ic text-4xl text-icon-muted">construction</span>
      <h1 className="text-lg font-extrabold text-ink">{title}</h1>
      {description && <p className="max-w-sm text-sm text-body">{description}</p>}
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">Écran à construire</p>
    </div>
  )
}

export function Loader() {
  return (
    <div className="flex justify-center p-5" role="status">
      <span className="h-9 w-9 motion-safe:animate-spin rounded-full border-4 border-line border-t-ink" />
      <span className="sr-only">Chargement...</span>
    </div>
  )
}

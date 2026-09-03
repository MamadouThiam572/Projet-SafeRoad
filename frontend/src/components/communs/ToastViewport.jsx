import { useToast } from '../../hooks/useToast'
import { Icone } from './Icone'

const STYLES = {
  succes: 'border-danger-faible bg-danger-faible-bg text-danger-faible',
  erreur: 'border-danger-critique bg-danger-critique-bg text-danger-critique',
}

export function ToastViewport() {
  const { toasts, retirer } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'erreur' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm font-medium shadow-md ${STYLES[toast.type]}`}
        >
          <Icone nom={toast.type === 'erreur' ? 'attention' : 'coche'} taille={16} className="mt-0.5 flex-none" />
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => retirer(toast.id)}
            className="flex-none opacity-70 hover:opacity-100"
            aria-label="Fermer la notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

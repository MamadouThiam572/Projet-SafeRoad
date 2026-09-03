import { useEffect, useRef } from 'react'
import { Icone } from './Icone'

// Modale de confirmation accessible (focus posé sur Annuler à l'ouverture, Échap et clic
// sur le fond annulent, `role="alertdialog"`). Pilotée par useConfirmDialog() : `etat` est
// `null` quand fermée.
export function ConfirmDialog({ etat, onConfirmer, onAnnuler }) {
  const boutonAnnulerRef = useRef(null)

  useEffect(() => {
    if (!etat) return
    boutonAnnulerRef.current?.focus()
    function onKeyDown(e) {
      if (e.key === 'Escape') onAnnuler()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [etat, onAnnuler])

  if (!etat) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={onAnnuler}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-titre"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-md rounded-md border border-line bg-surface p-6 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {etat.danger && (
            <span className="mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-danger-critique-bg text-danger-critique">
              <Icone nom="attention" taille={18} />
            </span>
          )}
          <div className="min-w-0">
            <h2 id="confirm-dialog-titre" className="font-display text-lg text-ink">
              {etat.titre}
            </h2>
            <p id="confirm-dialog-message" className="mt-2 text-sm leading-relaxed text-ink-soft">
              {etat.message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" ref={boutonAnnulerRef} className="btn btn-outline-secondary btn-sm" onClick={onAnnuler}>
            Annuler
          </button>
          <button
            type="button"
            className={`btn btn-sm ${etat.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirmer}
          >
            {etat.labelConfirmer ?? 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

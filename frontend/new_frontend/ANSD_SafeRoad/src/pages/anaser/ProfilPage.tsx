import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ChangementMotDePasse } from '@/pages/site/MotDePassePages'

export function ProfilPage() {
  const { user } = useAuth()
  const [changementMotDePasse, setChangementMotDePasse] = useState(false)

  if (!user) return null

  return (
    <div className="mx-6 mt-5 max-w-xl pb-8">
      <h1 className="text-[clamp(23px,2.8vw,30px)] font-extrabold leading-[1.15] tracking-[-0.026em] text-ink">
        Mon profil
      </h1>
      <p className="mt-2.5 text-sm leading-6 text-body">Informations de votre compte ANASER.</p>

      <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-faint">Nom complet</p>
          <p className="m-0 mt-1 text-sm font-bold text-ink">
            {user.firstName} {user.lastName}
          </p>
        </div>
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-faint">Email</p>
          <p className="m-0 mt-1 text-sm font-bold text-ink">{user.email}</p>
        </div>
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-faint">Rôle</p>
          <p className="m-0 mt-1 text-sm font-bold text-ink">ANASER — Agence nationale de la sécurité routière</p>
        </div>
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-faint">Portée</p>
          <p className="m-0 mt-1 text-sm font-bold text-ink">Vue nationale (toutes régions)</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm font-bold text-ink">Mot de passe</p>
          <button
            type="button"
            onClick={() => setChangementMotDePasse((v) => !v)}
            className="min-h-[44px] rounded-[9px] border border-brand-200 bg-brand-50 px-4 text-[12.5px] font-bold text-brand-600 hover:bg-brand-100"
          >
            Modifier le mot de passe
          </button>
        </div>
        {changementMotDePasse && (
          <ChangementMotDePasse type="personnel" onFermer={() => setChangementMotDePasse(false)} />
        )}
      </div>
    </div>
  )
}

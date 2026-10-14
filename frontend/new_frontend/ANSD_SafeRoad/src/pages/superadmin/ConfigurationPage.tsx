import { useEffect, useMemo, useState } from 'react'
import { ApiError, getConfiguration, modifierConfiguration, type ConfigurationApi } from '@/lib/api'

/**
 * Super Admin → Configuration : seuils nationaux appliqués par le backend (détection des zones,
 * alertes aux conducteurs, fiabilité GPS, supervision des boîtiers). Lecture seule pour les
 * autres rôles côté backend ; ici, modification réservée au super admin.
 */

type Cle = Exclude<keyof ConfigurationApi, 'date_maj' | 'modifie_par_nom'>

interface Champ {
  cle: Cle
  label: string
  aide: string
  unite: string
  min: number
  pas: number
}

const SECTIONS: { titre: string; icon: string; tint: string; soft: string; champs: Champ[] }[] = [
  {
    titre: 'Détection des zones à risque',
    icon: 'location_on',
    tint: '#7c3aed',
    soft: '#f1eafe',
    champs: [
      { cle: 'rayon_clustering_metres', label: 'Rayon de regroupement', aide: 'Distance maximale entre incidents pour former une zone.', unite: 'm', min: 50, pas: 10 },
      { cle: 'min_incidents_pour_zone', label: "Incidents minimum pour une zone", aide: "Nombre d'incidents rapprochés nécessaires pour proposer une zone.", unite: 'incidents', min: 2, pas: 1 },
      { cle: 'poids_signalement_valide', label: "Poids d'un signalement validé", aide: "Points ajoutés au score d'une zone par signalement validé (un incident compte 1).", unite: 'pt', min: 0, pas: 0.1 },
    ],
  },
  {
    titre: 'Alertes aux conducteurs',
    icon: 'notifications_active',
    tint: '#e8940c',
    soft: '#fdf4e6',
    champs: [
      { cle: 'rayon_alerte_proximite_metres', label: "Rayon d'alerte", aide: "Distance à une zone reconnue qui déclenche l'alerte du boîtier.", unite: 'm', min: 100, pas: 50 },
      { cle: 'cooldown_alerte_proximite_minutes', label: 'Délai entre deux alertes', aide: 'Pour une même zone et un même boîtier, évite les alertes répétées.', unite: 'min', min: 1, pas: 1 },
    ],
  },
  {
    titre: 'Fiabilité des positions GPS',
    icon: 'satellite_alt',
    tint: '#2b6cb0',
    soft: '#e8f0f9',
    champs: [
      { cle: 'gps_satellites_min', label: 'Satellites minimum', aide: 'En dessous, la position est conservée mais exclue du calcul des zones.', unite: 'satellites', min: 1, pas: 1 },
      { cle: 'gps_hdop_max', label: 'HDOP maximum', aide: 'Au-dessus, la position est jugée imprécise (plus petit = plus précis).', unite: '', min: 0.5, pas: 0.1 },
    ],
  },
  {
    titre: 'Supervision des boîtiers',
    icon: 'memory',
    tint: '#1f9d55',
    soft: '#e9f6ee',
    champs: [
      { cle: 'delai_hors_ligne_minutes', label: 'Délai avant « hors ligne »', aide: "Minutes sans données avant qu'un boîtier actif soit signalé hors ligne.", unite: 'min', min: 1, pas: 1 },
      { cle: 'intervalle_sync_secondes', label: 'Intervalle de synchronisation', aide: 'Rythme indiqué au firmware pour ses envois (informatif).', unite: 's', min: 5, pas: 5 },
      { cle: 'duree_grace_regeneration_cle_heures', label: "Validité de l'ancienne clé API", aide: "Après régénération, durée pendant laquelle l'ancienne clé reste acceptée.", unite: 'h', min: 0, pas: 1 },
    ],
  },
]

export function ConfigurationPage() {
  const [config, setConfig] = useState<ConfigurationApi | null>(null)
  const [brouillon, setBrouillon] = useState<Partial<Record<Cle, string>>>({})
  const [message, setMessage] = useState<{ texte: string; ok: boolean } | null>(null)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    getConfiguration().then(setConfig, (err) =>
      setMessage({ texte: err instanceof ApiError ? err.message : 'Serveur injoignable : vérifiez que le backend est lancé.', ok: false }),
    )
  }, [])

  const champs = useMemo(() => SECTIONS.flatMap((s) => s.champs), [])
  const modifies = champs.filter((c) => brouillon[c.cle] !== undefined && config && Number(brouillon[c.cle]) !== config[c.cle])
  const invalides = champs.filter((c) => brouillon[c.cle] !== undefined && (brouillon[c.cle] === '' || Number(brouillon[c.cle]) < c.min || Number.isNaN(Number(brouillon[c.cle]))))

  const enregistrer = async () => {
    if (!config || modifies.length === 0 || invalides.length > 0) return
    setEnvoi(true)
    try {
      const maj = await modifierConfiguration(Object.fromEntries(modifies.map((c) => [c.cle, Number(brouillon[c.cle])])))
      setConfig(maj)
      setBrouillon({})
      setMessage({ texte: `${modifies.length} paramètre${modifies.length > 1 ? 's' : ''} enregistré${modifies.length > 1 ? 's' : ''}. Ils s'appliquent immédiatement à tout le pays.`, ok: true })
    } catch (err) {
      setMessage({ texte: err instanceof ApiError ? err.message : 'Enregistrement impossible : serveur injoignable.', ok: false })
    } finally {
      setEnvoi(false)
    }
  }

  const headBtn =
    'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3 text-[12.5px] font-bold text-ink shadow-card transition-colors hover:bg-page disabled:opacity-50'

  return (
    <div className="pb-8">
      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-navy-900 text-white">
            <span className="ic text-[26px]">settings</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">Configuration</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">
              Seuils nationaux utilisés par la plateforme pour détecter les zones, alerter les conducteurs et superviser les boîtiers.
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button type="button" disabled={Object.keys(brouillon).length === 0} onClick={() => setBrouillon({})} className={headBtn}>
              <span className="ic text-xl text-info-600">undo</span>
              Annuler les modifications
            </button>
            <button
              type="button"
              disabled={envoi || modifies.length === 0 || invalides.length > 0}
              onClick={() => void enregistrer()}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-navy-900 px-5 py-3 text-[12.5px] font-bold text-white shadow-card hover:opacity-90 disabled:opacity-50"
            >
              <span className="ic text-xl">save</span>
              {envoi ? 'Enregistrement…' : `Enregistrer${modifies.length ? ` (${modifies.length})` : ''}`}
            </button>
          </div>
          {config && (
            <p className="m-0 text-[10.5px] font-medium text-faint">
              Dernière modification : {new Date(config.date_maj).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              {config.modifie_par_nom ? ` par ${config.modifie_par_nom}` : ''}
            </p>
          )}
          {message && <p className={`m-0 text-[11px] font-semibold ${message.ok ? 'text-success-600' : 'text-danger-600'}`}>{message.texte}</p>}
        </div>
      </section>

      <div className="mx-6 mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {SECTIONS.map((s) => (
          <section key={s.titre} className="min-w-0 rounded-xl border border-line bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: s.soft, color: s.tint }}>
                <span className="ic text-[22px]">{s.icon}</span>
              </span>
              <p className="m-0 text-[14.5px] font-extrabold text-navy-900">{s.titre}</p>
            </div>
            <div className="flex flex-col gap-4">
              {s.champs.map((c) => {
                const valeur = brouillon[c.cle] ?? (config ? String(config[c.cle]) : '')
                const change = brouillon[c.cle] !== undefined && config && Number(brouillon[c.cle]) !== config[c.cle]
                const faux = invalides.includes(c)
                return (
                  <label key={c.cle} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_170px]">
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-bold text-ink">
                        {c.label}
                        {change && <span className="ml-2 rounded bg-[#fdf4e6] px-1.5 py-0.5 text-[10px] font-bold text-warning-600">modifié</span>}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-faint">{c.aide}</span>
                    </span>
                    <span
                      className={`flex items-center overflow-hidden rounded-[9px] border-[1.5px] bg-white ${faux ? 'border-danger-600' : change ? 'border-warning-600' : 'border-line-field'}`}
                    >
                      <input
                        type="number"
                        min={c.min}
                        step={c.pas}
                        value={valeur}
                        disabled={!config}
                        onChange={(e) => setBrouillon((b) => ({ ...b, [c.cle]: e.target.value }))}
                        className="w-full min-w-0 bg-transparent px-3 py-2 text-right text-[13px] font-bold text-ink outline-none"
                      />
                      {c.unite && <span className="flex-none border-l border-line-field bg-page px-2.5 py-2 text-[11.5px] font-semibold text-faint">{c.unite}</span>}
                    </span>
                    {faux && <span className="text-[11px] font-semibold text-danger-600 sm:col-start-2">Valeur minimale : {c.min}</span>}
                  </label>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

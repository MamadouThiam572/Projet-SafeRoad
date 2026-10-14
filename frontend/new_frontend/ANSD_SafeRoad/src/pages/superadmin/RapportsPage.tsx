import { useState } from 'react'
import { ApiError, getStatistiquesDetaillees, type StatistiquesDetailleesApi } from '@/lib/api'
import { REGIONS } from '@/lib/regions'

/**
 * Super Admin → Rapports : rapport d'activité (national ou régional) sur une période, généré à
 * partir des vraies statistiques (GET /statistiques/detaillees/), à imprimer ou enregistrer en
 * PDF depuis le navigateur, ou à exporter en CSV.
 */

const PERIODES = [
  { jours: 7, label: 'Hebdomadaire (7 jours)' },
  { jours: 30, label: 'Mensuel (30 jours)' },
  { jours: 90, label: 'Trimestriel (3 mois)' },
  { jours: 365, label: 'Annuel (12 mois)' },
]

const nf = new Intl.NumberFormat('fr-FR')
const fmt = (n: number) => nf.format(n).replace(/\s/g, ' ')
const dateLongue = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

interface Rapport {
  titre: string
  periode: string
  regionLabel: string
  genereLe: Date
  depuis: Date
  donnees: StatistiquesDetailleesApi
}

/** Quelques phrases de synthèse, calculées sur les chiffres du rapport. */
function synthese(r: Rapport): string[] {
  const d = r.donnees
  const phrases: string[] = []
  const ind = d.indicateurs
  phrases.push(
    `Sur la période, ${fmt(ind.incidents)} incident${ind.incidents > 1 ? 's' : ''} ont été détectés par les boîtiers, ${fmt(ind.signalements)} signalement${ind.signalements > 1 ? 's' : ''} transmis par les conducteurs et ${fmt(ind.alertes)} alerte${ind.alertes > 1 ? 's' : ''} émises.`,
  )
  const type = d.incidents_par_type[0]
  if (type) phrases.push(`Le signal de risque le plus fréquent est « ${type.libelle} » (${type.pourcentage} % des incidents).`)
  const region = d.par_region.find((x) => x.incidents > 0)
  if (region && !d.perimetre.region) phrases.push(`${region.libelle} concentre le plus d'incidents (${fmt(region.incidents)}).`)
  const reconnues = d.zones_par_statut.find((g) => g.cle === 'reconnues')?.nombre ?? 0
  const aValider = d.zones_par_statut.find((g) => g.cle === 'a_valider')?.nombre ?? 0
  const soumises = d.zones_par_statut.find((g) => g.cle === 'soumises')?.nombre ?? 0
  phrases.push(
    `${fmt(ind.zones)} zone${ind.zones > 1 ? 's' : ''} à risque suivie${ind.zones > 1 ? 's' : ''} : ${fmt(reconnues)} reconnue${reconnues > 1 ? 's' : ''} par l'ANASER, ${fmt(soumises)} en attente de sa décision et ${fmt(aValider)} en validation technique.`,
  )
  return phrases
}

function Tableau({ entetes, lignes }: { entetes: string[]; lignes: (string | number)[][] }) {
  return (
    <table className="w-full border-collapse text-left text-[12px]">
      <thead>
        <tr className="border-b-2 border-navy-900 text-[10.5px] font-bold uppercase tracking-wide text-navy-900">
          {entetes.map((e, i) => (
            <th key={e} className={`py-2 pr-2 ${i > 0 ? 'text-right' : ''}`}>
              {e}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignes.length === 0 && (
          <tr>
            <td colSpan={entetes.length} className="py-3 text-center text-faint">
              Aucune donnée sur la période.
            </td>
          </tr>
        )}
        {lignes.map((l, i) => (
          <tr key={i} className="border-b border-line-soft">
            {l.map((v, j) => (
              <td key={j} className={`py-1.5 pr-2 ${j > 0 ? 'text-right' : 'font-semibold text-ink'}`}>
                {typeof v === 'number' ? fmt(v) : v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function RapportsPage() {
  const [jours, setJours] = useState(30)
  const [region, setRegion] = useState('')
  const [rapport, setRapport] = useState<Rapport | null>(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')

  const generer = async () => {
    setChargement(true)
    setErreur('')
    try {
      const donnees = await getStatistiquesDetaillees(jours, region || undefined)
      const genereLe = new Date()
      const regionLabel = region ? (REGIONS.find((r) => r.slug === region)?.label ?? region) : 'Sénégal (national)'
      setRapport({
        titre: `Rapport d'activité SafeRoad — ${region ? `Région de ${regionLabel}` : 'National'}`,
        periode: PERIODES.find((p) => p.jours === jours)?.label ?? `${jours} jours`,
        regionLabel,
        genereLe,
        depuis: new Date(genereLe.getTime() - jours * 86_400_000),
        donnees,
      })
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Génération impossible : serveur injoignable.')
    } finally {
      setChargement(false)
    }
  }

  const exporterCsv = () => {
    if (!rapport) return
    const d = rapport.donnees
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const lignes: (string | number)[][] = [
      [rapport.titre],
      [`Période : du ${dateLongue(rapport.depuis)} au ${dateLongue(rapport.genereLe)}`],
      [],
      ['Indicateur', 'Valeur'],
      ['Incidents', d.indicateurs.incidents],
      ['Signalements', d.indicateurs.signalements],
      ['Alertes', d.indicateurs.alertes],
      ['Événements', d.indicateurs.evenements],
      ['Zones à risque', d.indicateurs.zones],
      [],
      ['Région', 'Incidents', 'Signalements', 'Alertes', 'Zones'],
      ...d.par_region.map((r) => [r.libelle, r.incidents, r.signalements, r.alertes, r.zones]),
      [],
      ["Type d'incident", 'Nombre', '%'],
      ...d.incidents_par_type.map((t) => [t.libelle, t.nombre, t.pourcentage]),
      [],
      ['Type de signalement', 'Nombre', '%'],
      ...d.signalements_par_type.map((t) => [t.libelle, t.nombre, t.pourcentage]),
    ]
    const csv = '﻿' + lignes.map((l) => l.map(esc).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `rapport-saferoad-${rapport.genereLe.toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const selectCls =
    'w-full cursor-pointer rounded-[9px] border-[1.5px] border-line-field bg-white px-2.5 py-2 text-[12.5px] font-medium text-ink outline-none focus:border-brand-600'
  const headBtn =
    'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3 text-[12.5px] font-bold text-ink shadow-card transition-colors hover:bg-page disabled:opacity-50'

  const d = rapport?.donnees

  return (
    <div className="pb-8">
      {/* À l'impression, seul le rapport est imprimé (enregistrable en PDF depuis le navigateur). */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #rapport-imprimable, #rapport-imprimable * { visibility: visible !important; }
        #rapport-imprimable { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: 0; margin: 0; }
      }`}</style>

      <section className="mx-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-navy-900 text-white">
            <span className="ic text-[26px]">summarize</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,2.8vw,32px)] font-extrabold leading-[1.1] tracking-[-0.026em] text-navy-900">Rapports</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-info-600">
              Rapports d'activité nationaux ou régionaux, générés à partir des données réelles de la plateforme.
            </p>
          </div>
        </div>
        {rapport && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
            <button type="button" onClick={() => window.print()} className={headBtn}>
              <span className="ic text-xl text-info-600">print</span>
              Imprimer / PDF
            </button>
            <button type="button" onClick={exporterCsv} className={headBtn}>
              <span className="ic text-xl text-info-600">download</span>
              Exporter en CSV
            </button>
          </div>
        )}
      </section>

      <section className="mx-6 mt-4 grid grid-cols-1 items-end gap-3.5 rounded-xl border border-line bg-white p-4 shadow-card md:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-ink">Type de rapport</span>
          <select value={jours} onChange={(e) => setJours(Number(e.target.value))} className={selectCls}>
            {PERIODES.map((p) => (
              <option key={p.jours} value={p.jours}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-ink">Périmètre</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectCls}>
            <option value="">National (toutes les régions)</option>
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.slug}>
                Région de {r.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void generer()}
          disabled={chargement}
          className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg bg-navy-900 px-5 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          <span className="ic text-lg">auto_awesome</span>
          {chargement ? 'Génération…' : 'Générer le rapport'}
        </button>
        {erreur && <p className="m-0 text-[11.5px] font-semibold text-danger-600 md:col-span-3">{erreur}</p>}
      </section>

      {!rapport && !chargement && (
        <section className="mx-6 mt-4 rounded-xl border border-dashed border-line-field bg-white px-5 py-14 text-center shadow-card">
          <span className="ic text-[40px] text-faint">description</span>
          <p className="m-0 mt-2 text-[14px] font-extrabold text-navy-900">Aucun rapport généré</p>
          <p className="m-0 mt-1 text-[12.5px] text-body">Choisissez le type de rapport et le périmètre, puis cliquez sur « Générer le rapport ».</p>
        </section>
      )}

      {rapport && d && (
        <article id="rapport-imprimable" className="mx-6 mt-4 rounded-xl border border-line bg-white p-8 shadow-card">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-navy-900 pb-4">
            <div>
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-600">SafeRoad · ANSD</p>
              <h2 className="m-0 mt-1 text-[22px] font-extrabold text-navy-900">{rapport.titre}</h2>
              <p className="m-0 mt-1 text-[12.5px] text-body">
                {rapport.periode} — du {dateLongue(rapport.depuis)} au {dateLongue(rapport.genereLe)}
              </p>
            </div>
            <p className="m-0 text-right text-[11.5px] text-faint">
              Généré le {rapport.genereLe.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
              <br />
              Périmètre : {rapport.regionLabel}
            </p>
          </header>

          <section className="mt-5">
            <h3 className="m-0 text-[14px] font-extrabold text-navy-900">1. Synthèse</h3>
            <ul className="m-0 mt-2 list-disc pl-5 text-[12.5px] leading-relaxed text-body">
              {synthese(rapport).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>

          <section className="mt-5">
            <h3 className="m-0 text-[14px] font-extrabold text-navy-900">2. Indicateurs clés</h3>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['Incidents', d.indicateurs.incidents],
                ['Signalements', d.indicateurs.signalements],
                ['Alertes', d.indicateurs.alertes],
                ['Événements', d.indicateurs.evenements],
                ['Zones à risque', d.indicateurs.zones],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-line p-3">
                  <p className="m-0 text-[11px] font-bold text-faint">{l}</p>
                  <p className="m-0 mt-1 text-[22px] font-extrabold text-navy-900">{fmt(Number(v))}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section>
              <h3 className="m-0 mb-2 text-[14px] font-extrabold text-navy-900">3. Incidents par type</h3>
              <Tableau entetes={['Type', 'Nombre', '%']} lignes={d.incidents_par_type.map((t) => [t.libelle, t.nombre, `${t.pourcentage} %`])} />
            </section>
            <section>
              <h3 className="m-0 mb-2 text-[14px] font-extrabold text-navy-900">4. Signalements par type</h3>
              <Tableau entetes={['Type', 'Nombre', '%']} lignes={d.signalements_par_type.map((t) => [t.libelle, t.nombre, `${t.pourcentage} %`])} />
            </section>
            <section>
              <h3 className="m-0 mb-2 text-[14px] font-extrabold text-navy-900">5. Zones à risque par statut</h3>
              <Tableau entetes={['Statut', 'Zones', '%']} lignes={d.zones_par_statut.map((g) => [g.libelle, g.nombre, `${g.pourcentage} %`])} />
            </section>
            <section>
              <h3 className="m-0 mb-2 text-[14px] font-extrabold text-navy-900">6. Zones les plus actives</h3>
              <Tableau
                entetes={['Zone', 'Région', 'Incidents', 'Signalements']}
                lignes={d.zones_actives.map((z) => [z.nom, z.region_libelle ?? '—', z.incidents, z.signalements])}
              />
            </section>
          </div>

          <section className="mt-6">
            <h3 className="m-0 mb-2 text-[14px] font-extrabold text-navy-900">7. Synthèse par région</h3>
            <Tableau
              entetes={['Région', 'Incidents', 'Signalements', 'Alertes', 'Zones']}
              lignes={d.par_region.map((r) => [r.libelle, r.incidents, r.signalements, r.alertes, r.zones])}
            />
          </section>

          <footer className="mt-6 border-t border-line pt-3 text-[10.5px] text-faint">
            Données issues des boîtiers SafeRoad, des signalements des conducteurs et du circuit de validation des zones
            (validation technique par les administrateurs, reconnaissance officielle par l'ANASER).
          </footer>
        </article>
      )}
    </div>
  )
}

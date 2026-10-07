import { Link } from 'react-router-dom'
import { SafeRoadMap } from '@/components/site/SafeRoadMap'
import { PATHS } from '@/routes/paths'

/**
 * Aperçu cliquable de l'interface d'administration — fiche technique §2
 * bloc 4 : « montrer le produit plutôt que le décrire ». Ce n'est plus une
 * maquette abstraite : c'est la vraie carte, en mode aperçu (non
 * interactif — le clic doit ouvrir la page Carte, pas piloter un deuxième
 * widget en parallèle du vrai), dans un cadre de fenêtre.
 */
export function DemoPanel() {
  return (
    <Link to={PATHS.carte} className="group relative mx-auto block w-full max-w-lg">
      <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-card-hover transition-all duration-[260ms] group-hover:-translate-y-1">
        <div className="flex items-center gap-1.5 border-b border-line bg-field px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-danger-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning-50" />
          <span className="h-2.5 w-2.5 rounded-full bg-success-50" />
          <span className="ml-3 truncate text-[11.5px] font-semibold text-faint">
            admin.saferoad.sn · carte régionale
          </span>
        </div>

        <div className="relative">
          <SafeRoadMap variant="compact" interactive={false} frameless />
          <div className="absolute left-4 top-4 rounded-xl bg-white/95 px-3 py-2 text-[10.5px] font-bold text-body shadow-card">
            Région : Dakar
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <span className="text-[12.5px] font-bold text-brand-600">Voir la carte complète</span>
          <span className="ic text-lg text-brand-600 transition-transform duration-200 group-hover:translate-x-0.5">
            arrow_forward
          </span>
        </div>
      </div>

      <div className="absolute -right-3 -top-5 animate-float-a rounded-[14px] bg-white px-4 py-3 shadow-card-hover">
        <p className="text-kpi-value m-0 text-ink">14</p>
        <p className="text-label-secondary m-0">zones actives</p>
      </div>

      {/*
       * Sibling du cadre (pas de la carte) pour ne pas être rogné par son
       * overflow-hidden ; décalage recalculé pour flotter sous la carte
       * sans chevaucher le texte du bandeau « Voir la carte complète ».
       */}
      <div className="absolute bottom-8 left-6 animate-float-b rounded-[14px] bg-white px-4 py-3 shadow-card-hover">
        <p className="text-kpi-value m-0 text-ink">6</p>
        <p className="text-label-secondary m-0">boîtiers région</p>
      </div>
    </Link>
  )
}

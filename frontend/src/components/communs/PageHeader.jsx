import { Icone } from './Icone'

// En-tête de page admin : tuile d'icône de section (ancrage visuel, cohérent avec la sidebar),
// titre + description, et zone d'actions alignée à droite.
export function PageHeader({ titre, description, icone, actions }) {
  return (
    <header className="page-header">
      <div className="page-header__principal">
        {icone && (
          <span className="page-header__icone" aria-hidden="true">
            <Icone nom={icone} taille={22} />
          </span>
        )}
        <div className="page-header__texte">
          <h1 className="page-header__titre">{titre}</h1>
          {description && <p className="page-header__description">{description}</p>}
        </div>
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}

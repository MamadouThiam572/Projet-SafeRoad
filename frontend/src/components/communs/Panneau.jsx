import { Link } from 'react-router-dom'
import { Icone } from './Icone'

export function Panneau({ icone, titre, compteur, lien, children }) {
  return (
    <section className="panneau">
      <div className="panneau__entete">
        <h2 className="panneau__titre">
          <Icone nom={icone} taille={18} />
          {titre}
          <span className="panneau__compteur">{compteur}</span>
        </h2>
        {lien && (
          <Link className="panneau__lien" to={lien}>
            Tout voir <Icone nom="fleche" taille={14} />
          </Link>
        )}
      </div>
      <div className="panneau__corps">{children}</div>
    </section>
  )
}

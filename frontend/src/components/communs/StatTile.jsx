import { Link } from 'react-router-dom'
import { Icone } from './Icone'

export function StatTile({ label, valeur, icone, stripe, lien }) {
  return (
    <article className="stat-tile" style={{ '--stripe': stripe }}>
      <div className="stat-tile__haut">
        <span className="stat-tile__label">{label}</span>
        <span className="stat-tile__icone">
          <Icone nom={icone} taille={18} />
        </span>
      </div>
      <div className="stat-tile__valeur">{valeur}</div>
      {lien && (
        <Link className="stat-tile__lien" to={lien.to}>
          {lien.libelle} <Icone nom="fleche" taille={14} />
        </Link>
      )}
    </article>
  )
}

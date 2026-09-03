import { couleurNiveauDanger, libelleNiveauDanger } from '../../utils/niveauDangerColor'

const NIVEAUX = ['normale', 'vigilance', 'critique']

export function LegendeDanger() {
  return (
    <div className="legende-danger">
      {NIVEAUX.map((niveau) => (
        <span className="item" key={niveau}>
          <span className="puce" style={{ background: couleurNiveauDanger(niveau) }}></span>
          {libelleNiveauDanger(niveau)}
        </span>
      ))}
    </div>
  )
}

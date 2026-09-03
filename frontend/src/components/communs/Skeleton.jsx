// États de chargement de l'espace admin/ANASER : jamais un écran blanc ni un simple
// spinner sur une table déjà connue de l'utilisateur — un squelette qui préfigure la
// forme du contenu réduit la sensation d'attente et évite le « saut » brutal au chargement.

export function SkeletonLignes({ colonnes = 4, lignes = 5 }) {
  return (
    <>
      {Array.from({ length: lignes }).map((_, ligne) => (
        // eslint-disable-next-line react/no-array-index-key
        <tr key={ligne}>
          {Array.from({ length: colonnes }).map((_, colonne) => (
            // eslint-disable-next-line react/no-array-index-key
            <td key={colonne}>
              <span className="skeleton block h-4 rounded-full" style={{ width: `${60 + ((ligne * 7 + colonne * 13) % 35)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function SkeletonKpiGrid({ nombre = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: nombre }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="h-full rounded-xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="skeleton block h-3 w-20 rounded-full" />
            <span className="skeleton block h-9 w-9 rounded-lg" />
          </div>
          <span className="skeleton mt-4 block h-9 w-16 rounded-full" />
          <span className="skeleton mt-3 block h-3 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

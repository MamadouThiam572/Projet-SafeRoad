import { Link, Navigate, useParams } from 'react-router-dom'
import { ARTICLES, type Article } from '@/data/articles'
import { PATHS } from '@/routes/paths'

/** Zone photo manquante — même traitement que dans la vue liste (fiche §5). */
function MissingPhoto({ heightClass }: { heightClass: string }) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-1 rounded-[20px] border border-dashed border-line-field bg-field ${heightClass}`}
    >
      <span className="ic text-3xl text-icon-muted">image</span>
      <p className="m-0 text-[12px] font-semibold text-faint">Photo article</p>
      <p className="m-0 text-[11px] text-faint underline decoration-dotted underline-offset-2">or browse files</p>
    </div>
  )
}

function RelatedCard({ article }: { article: Article }) {
  return (
    <Link
      to={PATHS.article(article.id)}
      className="group flex items-center gap-3 overflow-hidden rounded-[14px] border border-line bg-white p-2.5 transition-colors hover:border-line-field"
    >
      {article.image ? (
        <img src={article.image} alt="" className="h-[80px] w-[130px] flex-none rounded-[10px] object-cover" />
      ) : (
        <div className="flex h-[80px] w-[130px] flex-none flex-col items-center justify-center gap-0.5 rounded-[10px] border border-dashed border-line-field bg-field">
          <span className="ic text-lg text-icon-muted">image</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-bold text-brand-700">{article.category}</span>
        <p className="m-0 mt-0.5 line-clamp-2 text-[13px] font-extrabold leading-[1.35] text-ink">{article.title}</p>
        <span className="mt-1 block text-[11px] font-semibold text-faint">{article.date}</span>
      </div>
    </Link>
  )
}

export function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const article = ARTICLES.find((a) => a.id === id)

  if (!article) {
    return <Navigate to={PATHS.actualites} replace />
  }

  /*
   * Trois articles connexes — même catégorie en priorité, complétés par les
   * autres si besoin, jamais l'article courant. Fiche §4 : « photos 130 px,
   * sans extrait » — on quitte la lecture, on revient à la navigation.
   */
  const related = [
    ...ARTICLES.filter((a) => a.id !== article.id && a.category === article.category),
    ...ARTICLES.filter((a) => a.id !== article.id && a.category !== article.category),
  ].slice(0, 3)

  return (
    <div className="bg-white pb-20">
      {/* Colonne de lecture à 820px — fiche §4 : à 16px de corps, ça donne une ligne de 70 à 80 caractères. */}
      <div className="mx-auto max-w-[820px] px-[26px] pt-10">
        <Link
          to={PATHS.actualites}
          className="flex items-center gap-1.5 text-[13px] font-bold text-brand-600 hover:text-brand-700"
        >
          <span className="ic text-lg">arrow_back</span>
          Toutes les actualités
        </Link>

        <div className="mt-5 flex items-center gap-2.5">
          <span className="rounded-[6px] bg-brand-50 px-2 py-1 text-[10.5px] font-bold text-brand-700">
            {article.category}
          </span>
          <span className="text-[12px] font-semibold text-faint">
            {article.date} · {article.readTime}
          </span>
        </div>

        <h1 className="mt-3 text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.12] tracking-[-0.028em] text-ink">
          {article.title}
        </h1>

        <div className="mt-6">
          {article.image ? (
            <img
              src={article.image}
              alt=""
              className="w-full rounded-[20px] object-cover"
              style={{ height: 'min(46vw, 380px)' }}
            />
          ) : (
            <MissingPhoto heightClass="" />
          )}
        </div>

        <p className="mt-7 text-[18px] font-semibold leading-[1.6] text-ink">{article.excerpt}</p>

        <div className="mt-6 flex flex-col gap-5">
          {article.paragraphs.map((p, i) => (
            <p key={i} className="m-0 text-[16px] leading-[1.85] text-[#41606F]">
              {p}
            </p>
          ))}
        </div>
      </div>

      {related.length > 0 && (
        <div className="container-site mt-14">
          <p className="text-card-title m-0 text-ink">À lire aussi</p>
          <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {related.map((a) => (
              <RelatedCard key={a.id} article={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

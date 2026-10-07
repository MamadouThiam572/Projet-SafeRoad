import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Reveal } from '@/components/site/Reveal'
import { ARTICLES, CATEGORIES, type Article, type Category } from '@/data/articles'
import { PATHS } from '@/routes/paths'

const CATEGORY_ALL = 'Toutes'
const INITIAL_COUNT = 6
const STEP = 3

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-none rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
        active ? 'bg-brand-600 text-white' : 'border-[1.5px] border-line-field bg-white text-body hover:border-line'
      }`}
    >
      {label}
    </button>
  )
}

/** Zone photo manquante — fiche §5, point de vigilance : « à combler avant mise en ligne ». */
function MissingPhoto({ heightClass }: { heightClass: string }) {
  return (
    <div
      className={`flex w-full flex-none flex-col items-center justify-center gap-1 border-b border-dashed border-line-field bg-field ${heightClass}`}
    >
      <span className="ic text-3xl text-icon-muted">image</span>
      <p className="m-0 text-[12px] font-semibold text-faint">Photo article</p>
      <p className="m-0 text-[11px] text-faint underline decoration-dotted underline-offset-2">or browse files</p>
    </div>
  )
}

function NewsCard({ article }: { article: Article }) {
  return (
    <Link
      to={PATHS.article(article.id)}
      className="group flex flex-col overflow-hidden rounded-[18px] border border-line bg-white shadow-card transition-all duration-[250ms] hover:-translate-y-[5px] hover:shadow-card-hover"
    >
      {article.image ? (
        <img src={article.image} alt="" className="h-[172px] w-full flex-none object-cover" />
      ) : (
        <MissingPhoto heightClass="h-[172px]" />
      )}
      <div className="flex flex-1 flex-col px-[22px] pb-6 pt-[22px]">
        <span className="self-start rounded-[6px] bg-brand-50 px-2 py-1 text-[10.5px] font-bold text-brand-700">
          {article.category}
        </span>
        <p className="m-0 mt-3 text-[16.5px] font-extrabold leading-[1.35] text-ink">{article.title}</p>
        <p className="mt-2 flex-1 text-[13.5px] leading-[1.6] text-body">{article.excerpt}</p>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-[15px] text-[12px]">
          <span className="font-semibold text-faint">{article.date}</span>
          <span className="flex items-center gap-1 font-bold text-brand-600 transition-transform duration-200 group-hover:translate-x-0.5">
            Lire la suite
            <span className="ic text-base">arrow_forward</span>
          </span>
        </div>
      </div>
    </Link>
  )
}

function FeaturedCard({ article }: { article: Article }) {
  return (
    <Link
      to={PATHS.article(article.id)}
      className="grid overflow-hidden rounded-[22px] border border-line bg-white transition-shadow duration-200 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]"
      style={{ boxShadow: '0 6px 26px rgba(10,43,61,.10)' }}
    >
      {article.image ? (
        <img src={article.image} alt="" className="h-full min-h-[300px] w-full object-cover" />
      ) : (
        <MissingPhoto heightClass="min-h-[300px] h-full" />
      )}
      <div className="flex flex-col justify-center px-[38px] py-10">
        <div className="flex items-center gap-2">
          <span className="rounded-[6px] bg-brand-600 px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white">
            À la une
          </span>
          <span className="text-[10.5px] font-bold text-faint">{article.category}</span>
        </div>
        <p className="m-0 mt-3 text-[clamp(22px,2.6vw,30px)] font-extrabold leading-[1.2] tracking-[-0.02em] text-ink">
          {article.title}
        </p>
        <p className="mt-3 text-[14.5px] leading-[1.65] text-body">{article.excerpt}</p>
        <div className="mt-5 flex items-center gap-4 text-[12px]">
          <span className="font-semibold text-faint">{article.date}</span>
          <span className="flex items-center gap-1 font-bold text-brand-600">
            Lire la suite
            <span className="ic text-base">arrow_forward</span>
          </span>
        </div>
      </div>
    </Link>
  )
}

export function ActualitesPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>(CATEGORY_ALL)
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT)

  useEffect(() => {
    setVisibleCount(INITIAL_COUNT)
  }, [search, category])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ARTICLES.filter((a) => {
      if (category !== CATEGORY_ALL && a.category !== category) return false
      if (!q) return true
      return a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    })
  }, [search, category])

  /*
   * La une ne s'affiche que sans filtre actif — fiche §2.3 : dès qu'un
   * filtre s'applique, tous les résultats redeviennent égaux. L'article mis
   * en avant est alors retiré de la grille pour éviter le doublon.
   */
  const showFeatured = category === CATEGORY_ALL && search.trim() === '' && filtered.length > 0
  const featured = showFeatured ? filtered[0] : null
  const gridArticles = showFeatured ? filtered.slice(1) : filtered
  const visible = gridArticles.slice(0, visibleCount)
  const hasMore = visibleCount < gridArticles.length

  return (
    <div className="bg-white pb-20">
      {/* Bandeau navy — remplissage dissymétrique (64px / 72px) qui compense optiquement le poids du titre. */}
      <div className="bg-navy-900 pb-[72px] pt-16">
        <div className="container-site">
          <span className="text-[12.5px] font-bold uppercase tracking-[.06em] text-brand-200">
            Le journal SafeRoad
          </span>
          <h1 className="text-hero mt-2 text-white">Nos actualités</h1>
          <p className="mt-3 max-w-[600px] text-[17px] leading-[1.6] text-white/80">
            Restez informé des dernières nouvelles, innovations et actions de SafeRoad.
          </p>
        </div>
      </div>

      <div className="container-site mt-10">
        {/* Recherche + filtres — une seule rangée flexible, repliée d'elle-même sans requête média. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex h-[45px] min-w-[250px] max-w-[380px] flex-1 items-center gap-2 rounded-xl border-[1.5px] border-line-field bg-field px-3.5">
            <span className="ic flex-none text-xl text-faint">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un article…"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-faint"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <CategoryPill label={CATEGORY_ALL} active={category === CATEGORY_ALL} onClick={() => setCategory(CATEGORY_ALL)} />
            {CATEGORIES.map((c: Category) => (
              <CategoryPill key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
            ))}
          </div>
        </div>

        {featured && (
          <Reveal className="mt-8">
            <FeaturedCard article={featured} />
          </Reveal>
        )}

        {gridArticles.length > 0 ? (
          <>
            <div className="mt-8 grid gap-[22px] [grid-template-columns:repeat(auto-fit,minmax(268px,1fr))]">
              {visible.map((article, i) => (
                <Reveal key={article.id} delay={(i % STEP) * 80}>
                  <NewsCard article={article} />
                </Reveal>
              ))}
            </div>

            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((v) => v + STEP)}
                className="mx-auto mt-10 flex h-12 items-center justify-center rounded-full border-[1.5px] border-line px-7 text-sm font-bold text-ink transition-colors hover:border-brand-600 hover:text-brand-600"
              >
                Charger plus d'articles
              </button>
            )}
          </>
        ) : (
          <div className="mt-8 flex flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-line-field py-16 text-center">
            <span className="ic text-[60px] leading-none text-icon-muted">search_off</span>
            <p className="m-0 mt-2 text-base font-extrabold text-ink">Aucun article ne correspond à cette recherche</p>
            <p className="max-w-sm text-sm text-body">
              Essayez un autre mot-clé, ou retirez le filtre de catégorie sélectionné.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

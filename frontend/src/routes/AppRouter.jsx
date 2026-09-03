import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loader } from '../components/communs/Loader'
import { Footer } from '../components/layout/Footer'
import { Navbar } from '../components/layout/Navbar'
import { AccueilPage } from '../pages/public/AccueilPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { NotFoundPage } from '../pages/public/NotFoundPage'
import { RouteProtegee } from './RouteProtegee'

// Chargées à la demande : Leaflet (~150 Ko) et tout l'espace admin/ANASER ne doivent pas
// alourdir le premier chargement d'un citoyen qui visite l'accueil public.
const CartePubliquePage = lazy(() => import('../pages/public/CartePubliquePage').then((m) => ({ default: m.CartePubliquePage })))
const StatistiquesPubliquesPage = lazy(() => import('../pages/public/StatistiquesPubliquesPage').then((m) => ({ default: m.StatistiquesPubliquesPage })))
const PolitiqueConfidentialitePage = lazy(() => import('../pages/public/PolitiqueConfidentialitePage').then((m) => ({ default: m.PolitiqueConfidentialitePage })))
const MentionsLegalesPage = lazy(() => import('../pages/public/MentionsLegalesPage').then((m) => ({ default: m.MentionsLegalesPage })))
const AccessibilitePage = lazy(() => import('../pages/public/AccessibilitePage').then((m) => ({ default: m.AccessibilitePage })))
const AdminLayout = lazy(() => import('../components/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const DashboardPage = lazy(() => import('../pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ZonesAValiderPage = lazy(() => import('../pages/admin/ZonesAValiderPage').then((m) => ({ default: m.ZonesAValiderPage })))
const AlertesPage = lazy(() => import('../pages/admin/AlertesPage').then((m) => ({ default: m.AlertesPage })))
const BoitiersListPage = lazy(() => import('../pages/admin/BoitiersListPage').then((m) => ({ default: m.BoitiersListPage })))
const EvenementsPage = lazy(() => import('../pages/admin/EvenementsPage').then((m) => ({ default: m.EvenementsPage })))
const ConfigurationPage = lazy(() => import('../pages/admin/ConfigurationPage').then((m) => ({ default: m.ConfigurationPage })))
const ProfilPage = lazy(() => import('../pages/admin/ProfilPage').then((m) => ({ default: m.ProfilPage })))
const AnaserLayout = lazy(() => import('../components/layout/AnaserLayout').then((m) => ({ default: m.AnaserLayout })))
const AnaserDashboardPage = lazy(() => import('../pages/anaser/AnaserDashboardPage').then((m) => ({ default: m.AnaserDashboardPage })))
const AnaserZonesPage = lazy(() => import('../pages/anaser/AnaserZonesPage').then((m) => ({ default: m.AnaserZonesPage })))
const AnaserFeedbackPage = lazy(() => import('../pages/anaser/AnaserFeedbackPage').then((m) => ({ default: m.AnaserFeedbackPage })))

export function AppRouter() {
  // Les espaces admin et ANASER possèdent chacun leur propre shell pleine hauteur
  // (sidebar + barre du haut) : on masque la navbar publique globale sur ces routes.
  const location = useLocation()
  const estEspacePrive = location.pathname.startsWith('/admin') || location.pathname.startsWith('/anaser')
  const estConnexion = location.pathname === '/login'

  return (
    <>
      {!estEspacePrive && (
        <>
          <a href="#contenu-principal" className="skip-link">Aller au contenu principal</a>
          <Navbar />
        </>
      )}
      <Suspense fallback={<Loader />}>
        {/* Pas de balise <main> ici : les routes admin/ANASER ont déjà la leur (AdminLayout/
            AnaserLayout) — un <main> imbriqué casserait la sémantique des landmarks. */}
        <div id={!estEspacePrive ? 'contenu-principal' : undefined}>
          <Routes>
            <Route path="/" element={<AccueilPage />} />
            <Route path="/carte" element={<CartePubliquePage />} />
            <Route path="/statistiques" element={<StatistiquesPubliquesPage />} />
            <Route path="/confidentialite" element={<PolitiqueConfidentialitePage />} />
            <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
            <Route path="/accessibilite" element={<AccessibilitePage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Espace administrateur : protégé une fois au niveau du layout, sous-pages imbriquées via <Outlet /> */}
            <Route
              path="/admin"
              element={
                <RouteProtegee rolesAutorises={['admin']}>
                  <AdminLayout />
                </RouteProtegee>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="zones" element={<ZonesAValiderPage />} />
              <Route path="alertes" element={<AlertesPage />} />
              <Route path="boitiers" element={<BoitiersListPage />} />
              <Route path="evenements" element={<EvenementsPage />} />
              <Route path="configuration" element={<ConfigurationPage />} />
              <Route path="profil" element={<ProfilPage />} />
            </Route>

            {/* Espace ANASER : même principe, shell dédié + sous-pages imbriquées */}
            <Route
              path="/anaser"
              element={
                <RouteProtegee rolesAutorises={['anaser']}>
                  <AnaserLayout />
                </RouteProtegee>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AnaserDashboardPage />} />
              <Route path="zones" element={<AnaserZonesPage />} />
              <Route path="feedback" element={<AnaserFeedbackPage />} />
              <Route path="profil" element={<ProfilPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </Suspense>
      {!estEspacePrive && !estConnexion && <Footer />}
    </>
  )
}

import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminLayout } from '../components/layout/AdminLayout'
import { AnaserLayout } from '../components/layout/AnaserLayout'
import { Footer } from '../components/layout/Footer'
import { Navbar } from '../components/layout/Navbar'
import { LoginPage } from '../pages/auth/LoginPage'
import { AccueilPage } from '../pages/public/AccueilPage'
import { CartePubliquePage } from '../pages/public/CartePubliquePage'
import { StatistiquesPubliquesPage } from '../pages/public/StatistiquesPubliquesPage'
import { AlertesPage } from '../pages/admin/AlertesPage'
import { BoitiersListPage } from '../pages/admin/BoitiersListPage'
import { ConfigurationPage } from '../pages/admin/ConfigurationPage'
import { DashboardPage } from '../pages/admin/DashboardPage'
import { ZonesAValiderPage } from '../pages/admin/ZonesAValiderPage'
import { AnaserDashboardPage } from '../pages/anaser/AnaserDashboardPage'
import { AnaserFeedbackPage } from '../pages/anaser/AnaserFeedbackPage'
import { AnaserZonesPage } from '../pages/anaser/AnaserZonesPage'
import { RouteProtegee } from './RouteProtegee'

export function AppRouter() {
  // Les espaces admin et ANASER possèdent chacun leur propre shell pleine hauteur
  // (sidebar + barre du haut) : on masque la navbar publique globale sur ces routes.
  const location = useLocation()
  const estEspacePrive = location.pathname.startsWith('/admin') || location.pathname.startsWith('/anaser')
  const estConnexion = location.pathname === '/login'

  return (
    <>
      {!estEspacePrive && <Navbar />}
      <Routes>
        <Route path="/" element={<AccueilPage />} />
        <Route path="/carte" element={<CartePubliquePage />} />
        <Route path="/statistiques" element={<StatistiquesPubliquesPage />} />
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
          <Route path="configuration" element={<ConfigurationPage />} />
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
        </Route>
      </Routes>
      {!estEspacePrive && !estConnexion && <Footer />}
    </>
  )
}

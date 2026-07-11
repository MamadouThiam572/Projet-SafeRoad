import { Route, Routes } from 'react-router-dom'
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
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<AccueilPage />} />
        <Route path="/carte" element={<CartePubliquePage />} />
        <Route path="/statistiques" element={<StatistiquesPubliquesPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route path="/admin/dashboard" element={
          <RouteProtegee rolesAutorises={['admin']}><DashboardPage /></RouteProtegee>
        } />
        <Route path="/admin/boitiers" element={
          <RouteProtegee rolesAutorises={['admin']}><BoitiersListPage /></RouteProtegee>
        } />
        <Route path="/admin/zones" element={
          <RouteProtegee rolesAutorises={['admin']}><ZonesAValiderPage /></RouteProtegee>
        } />
        <Route path="/admin/alertes" element={
          <RouteProtegee rolesAutorises={['admin']}><AlertesPage /></RouteProtegee>
        } />
        <Route path="/admin/configuration" element={
          <RouteProtegee rolesAutorises={['admin']}><ConfigurationPage /></RouteProtegee>
        } />

        <Route path="/anaser/dashboard" element={
          <RouteProtegee rolesAutorises={['anaser']}><AnaserDashboardPage /></RouteProtegee>
        } />
        <Route path="/anaser/zones" element={
          <RouteProtegee rolesAutorises={['anaser']}><AnaserZonesPage /></RouteProtegee>
        } />
        <Route path="/anaser/feedback" element={
          <RouteProtegee rolesAutorises={['anaser']}><AnaserFeedbackPage /></RouteProtegee>
        } />
      </Routes>
    </>
  )
}

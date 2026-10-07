import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { AnaserLayout } from '@/components/layout/AnaserLayout'
import { ClientLayout } from '@/components/layout/ClientLayout'
import { PageStub } from '@/components/layout/PageStub'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { SuperAdminLayout } from '@/components/layout/SuperAdminLayout'
import { AlertesPage as AdminAlertesPage } from '@/pages/admin/AlertesPage'
import { BoitiersPage as AdminBoitiersPage } from '@/pages/admin/BoitiersPage'
import { CarteRegionalePage } from '@/pages/admin/CarteRegionalePage'
import { DashboardPage as AdminDashboardPage } from '@/pages/admin/DashboardPage'
import { HistoriquePage as AdminHistoriquePage } from '@/pages/admin/HistoriquePage'
import { IncidentsPage as AdminIncidentsPage } from '@/pages/admin/IncidentsPage'
import { MonitoringPage as AdminMonitoringPage } from '@/pages/admin/MonitoringPage'
import { SignalementsPage as AdminSignalementsPage } from '@/pages/admin/SignalementsPage'
import { SignalementsPage as SuperAdminSignalementsPage } from '@/pages/superadmin/SignalementsPage'
import { ZonesPage as SuperAdminZonesPage } from '@/pages/superadmin/ZonesPage'
import { ZonesPage as AdminZonesPage } from '@/pages/admin/ZonesPage'
import { DashboardPage as AnaserDashboardPage } from '@/pages/anaser/DashboardPage'
import { ProfilPage as AnaserProfilPage } from '@/pages/anaser/ProfilPage'
import { RetoursPage as AnaserRetoursPage } from '@/pages/anaser/RetoursPage'
import { DashboardPage as SuperAdminDashboardPage } from '@/pages/superadmin/DashboardPage'
import { UtilisateursPage as SuperAdminUtilisateursPage } from '@/pages/superadmin/UtilisateursPage'
import { BoitiersPage as SuperAdminBoitiersPage } from '@/pages/superadmin/BoitiersPage'
import { MonitoringPage as SuperAdminMonitoringPage } from '@/pages/superadmin/MonitoringPage'
import { IncidentsPage as SuperAdminIncidentsPage } from '@/pages/superadmin/IncidentsPage'
import { AccueilPage as ClientAccueilPage } from '@/pages/client/AccueilPage'
import { AlertesPage } from '@/pages/client/AlertesPage'
import { CarteZonesPage } from '@/pages/client/CarteZonesPage'
import { ProfilPage } from '@/pages/client/ProfilPage'
import { SignalementsPage } from '@/pages/client/SignalementsPage'
import { TrajetsPage } from '@/pages/client/TrajetsPage'
import { AccueilPage } from '@/pages/site/AccueilPage'
import { ActualitesPage } from '@/pages/site/ActualitesPage'
import { AProposPage } from '@/pages/site/AProposPage'
import { ArticlePage } from '@/pages/site/ArticlePage'
import { CartePage } from '@/pages/site/CartePage'
import { ConnexionPage } from '@/pages/site/ConnexionPage'
import { ContactPage } from '@/pages/site/ContactPage'
import { InscriptionPage } from '@/pages/site/InscriptionPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PATHS } from '@/routes/paths'

export function AppRoutes() {
  return (
    <Routes>
      {/* Site vitrine */}
      <Route element={<SiteLayout />}>
        <Route path={PATHS.home} element={<AccueilPage />} />
        <Route path={PATHS.carte} element={<CartePage />} />
        <Route path={PATHS.aPropos} element={<AProposPage />} />
        <Route path={PATHS.actualites} element={<ActualitesPage />} />
        <Route path={PATHS.articlePattern} element={<ArticlePage />} />
        <Route path={PATHS.contact} element={<ContactPage />} />
      </Route>
      <Route path={PATHS.connexion} element={<ConnexionPage />} />
      <Route path={PATHS.inscription} element={<InscriptionPage />} />

      {/* Conducteur / Client */}
      <Route element={<ProtectedRoute allowedRoles={['conducteur']} />}>
        <Route element={<ClientLayout />}>
          <Route path={PATHS.client.root} element={<ClientAccueilPage />} />
          <Route path={PATHS.client.carte} element={<CarteZonesPage />} />
          <Route path={PATHS.client.alertes} element={<AlertesPage />} />
          <Route path={PATHS.client.trajets} element={<TrajetsPage />} />
          <Route path={PATHS.client.signalements} element={<SignalementsPage />} />
          <Route path={PATHS.client.profil} element={<ProfilPage />} />
        </Route>
      </Route>

      {/* Admin Régional */}
      <Route element={<ProtectedRoute allowedRoles={['sous_admin']} />}>
        <Route element={<AdminLayout />}>
          <Route path={PATHS.admin.root} element={<AdminDashboardPage />} />
          <Route path={PATHS.admin.monitoring} element={<AdminMonitoringPage />} />
          <Route path={PATHS.admin.carte} element={<CarteRegionalePage />} />
          <Route path={PATHS.admin.incidents} element={<AdminIncidentsPage />} />
          <Route path={PATHS.admin.signalements} element={<AdminSignalementsPage />} />
          <Route path={PATHS.admin.zones} element={<AdminZonesPage />} />
          <Route path={PATHS.admin.alertes} element={<AdminAlertesPage />} />
          <Route path={PATHS.admin.boitiers} element={<AdminBoitiersPage />} />
          {/* La page Statistiques dédiée a été retirée : ses indicateurs vivent
              maintenant dans une section « Statistiques » sur la page Historique. */}
          <Route path={PATHS.admin.historique} element={<AdminHistoriquePage />} />
        </Route>
      </Route>

      {/* ANASER — rôle consultatif + retour terrain, portée nationale.
          Lecture seule sur incidents/zones (y compris non validées)/statistiques ;
          seul pouvoir d'écriture : soumettre un retour officiel (AlerteAnaser). */}
      <Route element={<ProtectedRoute allowedRoles={['anaser']} />}>
        <Route element={<AnaserLayout />}>
          <Route path={PATHS.anaser.root} element={<AnaserDashboardPage />} />
          <Route
            path={PATHS.anaser.incidents}
            element={
              <PageStub
                title="Incidents"
                description="Vue nationale, lecture seule. Consultation de tous les incidents remontés par les boîtiers."
              />
            }
          />
          <Route
            path={PATHS.anaser.zones}
            element={
              <PageStub
                title="Zones à risque"
                description="Vue nationale, y compris les zones en attente de validation. La validation reste réservée aux administrateurs."
              />
            }
          />
          <Route
            path={PATHS.anaser.statistiques}
            element={<PageStub title="Statistiques" description="Statistiques nationales de sécurité routière." />}
          />
          <Route path={PATHS.anaser.retours} element={<AnaserRetoursPage />} />
          <Route path={PATHS.anaser.profil} element={<AnaserProfilPage />} />
        </Route>
      </Route>

      {/* Super Admin */}
      <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
        <Route element={<SuperAdminLayout />}>
          <Route path={PATHS.superAdmin.root} element={<SuperAdminDashboardPage />} />
          <Route path={PATHS.superAdmin.utilisateurs} element={<SuperAdminUtilisateursPage />} />
          <Route path={PATHS.superAdmin.boitiers} element={<SuperAdminBoitiersPage />} />
          <Route path={PATHS.superAdmin.monitoring} element={<SuperAdminMonitoringPage />} />
          <Route path={PATHS.superAdmin.incidents} element={<SuperAdminIncidentsPage />} />
          <Route path={PATHS.superAdmin.signalements} element={<SuperAdminSignalementsPage />} />
          <Route path={PATHS.superAdmin.zones} element={<SuperAdminZonesPage />} />
          <Route path={PATHS.superAdmin.statistiques} element={<PageStub title="Statistiques" />} />
          <Route path={PATHS.superAdmin.notifications} element={<PageStub title="Notifications" />} />
          <Route path={PATHS.superAdmin.rapports} element={<PageStub title="Rapports" />} />
          <Route path={PATHS.superAdmin.configuration} element={<PageStub title="Configuration" />} />
          <Route path={PATHS.superAdmin.historique} element={<PageStub title="Historique" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={PATHS.home} replace />} />
    </Routes>
  )
}

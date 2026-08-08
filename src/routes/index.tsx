import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { MfaEnrollPage, MfaVerifyPage } from '@/pages/admin/MfaPage'
import { AdminCamposPetPage } from '@/pages/admin/AdminCamposPetPage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminOrganizacoesPage } from '@/pages/admin/AdminOrganizacoesPage'
import { AdminRetencaoPage } from '@/pages/admin/AdminRetencaoPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterHubPage } from '@/pages/auth/RegisterHubPage'
import { RegisterOrgaoPage } from '@/pages/auth/RegisterOrgaoPage'
import { RegisterTutorPage } from '@/pages/auth/RegisterTutorPage'
import { OrgaoDashboardPage } from '@/pages/orgao/OrgaoDashboardPage'
import { OrgaoEncontreiPage } from '@/pages/orgao/OrgaoEncontreiPage'
import {
  OrgaoPendingPage,
  OrgaoRejectedPage,
} from '@/pages/orgao/OrgaoPendingPage'
import { PetPublicPage } from '@/pages/public/PetPublicPage'
import { QrReadPage } from '@/pages/public/QrReadPage'
import { RescueRegisterPage } from '@/pages/public/RescueRegisterPage'
import { TutorDashboardPage } from '@/pages/tutor/TutorDashboardPage'
import { TutorMatchesPage } from '@/pages/tutor/TutorMatchesPage'
import { TutorOcorrenciasPage } from '@/pages/tutor/TutorOcorrenciasPage'
import { TutorProfilePage } from '@/pages/tutor/TutorProfilePage'
import { PetDetailPage } from '@/pages/tutor/PetDetailPage'
import { PetNewPage } from '@/pages/tutor/PetNewPage'
import { LostOccurrencePage } from '@/pages/tutor/LostOccurrencePage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="pet/:payload" element={<PetPublicPage />} />
        <Route path="qr/:payload" element={<QrReadPage />} />
        <Route path="resgate" element={<RescueRegisterPage />} />
        <Route path="cadastro" element={<RegisterHubPage />} />
        <Route path="cadastro/tutor" element={<RegisterTutorPage />} />
        <Route path="cadastro/organizacao" element={<RegisterOrgaoPage />} />
      </Route>

      <Route index element={<Navigate to="/login" replace />} />
      <Route path="login" element={<LoginPage />} />

      <Route element={<ProtectedRoute allowedRoles={['tutor']} />}>
        <Route path="tutor" element={<AppLayout area="tutor" />}>
          <Route index element={<TutorDashboardPage />} />
          <Route path="perfil" element={<TutorProfilePage />} />
          <Route path="ocorrencias" element={<TutorOcorrenciasPage />} />
          <Route path="matches" element={<TutorMatchesPage />} />
          <Route path="pets/novo" element={<PetNewPage />} />
          <Route path="pets/:id" element={<PetDetailPage />} />
          <Route path="pets/:id/perdido" element={<LostOccurrencePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['orgao']} onlyPendingOrgao />}>
        <Route path="orgao/aguardando" element={<OrgaoPendingPage />} />
        <Route path="orgao/rejeitado" element={<OrgaoRejectedPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute allowedRoles={['orgao']} requireOrgApproved />
        }
      >
        <Route path="orgao" element={<AppLayout area="orgao" />}>
          <Route index element={<OrgaoDashboardPage />} />
          <Route path="encontrei" element={<OrgaoEncontreiPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="admin/mfa/cadastrar" element={<MfaEnrollPage />} />
        <Route path="admin/mfa/verificar" element={<MfaVerifyPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute allowedRoles={['admin']} requireAdminMfa />
        }
      >
        <Route path="admin" element={<AppLayout area="admin" />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="organizacoes" element={<AdminOrganizacoesPage />} />
          <Route path="campos-pet" element={<AdminCamposPetPage />} />
          <Route path="retencao" element={<AdminRetencaoPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

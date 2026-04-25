import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

import AuthPage from '../pages/AuthPage'
import OnboardingPage from '../pages/OnboardingPage'
import LoadingScreen from '../components/shared/LoadingScreen'

import StudentRoutes from './StudentRoutes'
import TeacherRoutes from './TeacherRoutes'
import AdminRoutes from './AdminRoutes'

function RoleRouter() {
  const { user, role, requiresOnboarding, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/auth" replace />
  if (requiresOnboarding) return <Navigate to="/onboarding" replace />
  if (!role) return <Navigate to="/onboarding" replace />
  if (role === 'student') return <StudentRoutes />
  if (role === 'teacher') return <TeacherRoutes />
  if (role === 'admin') return <AdminRoutes />

  return <Navigate to="/auth" replace />
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/*" element={<RoleRouter />} />
      </Routes>
    </BrowserRouter>
  )
}
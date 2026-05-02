import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { MockAuthProvider } from '@/contexts/AuthContextMock'
import { RequireAuth, RedirectIfAuth } from '@/components/RouteGuards'
import { SampleTransactionProvider } from '@/stores/sampleTransactionStore'
import AppShell from '@/components/layout/AppShell'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import PrivacyPage from '@/pages/PrivacyPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import SignupPage from '@/pages/SignupPage'

const ActiveAuthProvider = import.meta.env.VITE_USE_MOCK === 'true' ? MockAuthProvider : AuthProvider

export default function App() {
  return (
    <BrowserRouter>
      <ActiveAuthProvider>
        <Routes>
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Public routes — redirect to /app if already logged in */}
          <Route element={<RedirectIfAuth />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<LandingPage />} />
          </Route>

          {/* Protected routes — require login */}
          <Route element={<RequireAuth />}>
            <Route path="/app/*" element={<SampleTransactionProvider><AppShell /></SampleTransactionProvider>} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ActiveAuthProvider>
    </BrowserRouter>
  )
}

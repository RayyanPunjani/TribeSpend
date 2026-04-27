import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { MockAuthProvider } from '@/contexts/AuthContextMock'
import { RequireAuth, RedirectIfAuth } from '@/components/RouteGuards'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'

const ActiveAuthProvider = import.meta.env.VITE_USE_MOCK === 'true' ? MockAuthProvider : AuthProvider

export default function App() {
  return (
    <BrowserRouter>
      <ActiveAuthProvider>
        <Routes>
          {/* Public routes — redirect to /app if already logged in */}
          <Route element={<RedirectIfAuth />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            {/* Landing page — for now redirect to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Route>

          {/* Protected routes — require login */}
          <Route element={<RequireAuth />}>
            <Route path="/app/*" element={<AppShell />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ActiveAuthProvider>
    </BrowserRouter>
  )
}

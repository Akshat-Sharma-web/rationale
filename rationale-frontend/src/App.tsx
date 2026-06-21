import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { BrowserRouter } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useAuthStore } from './store/authStore'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Dashboard } from './pages/Dashboard'
import { Analytics } from './pages/Analytics'
import { WorkspaceSettings } from './pages/WorkspaceSettings'
import { NewDecision } from './pages/NewDecision'
import { DecisionDetail } from './pages/DecisionDetail'
import { JoinWorkspace } from './pages/JoinWorkspace'

/**
 * AuthGate mounts the onAuthStateChange listener once at the root level
 * and renders the router tree after the initial session check resolves.
 */
function AuthGate() {
  useAuth() // subscribes to Supabase auth changes → syncs into authStore
  const isLoading = useAuthStore((s) => s.isLoading)

  if (isLoading) {
    return (
      <div className="auth-loading">
        <span className="auth-loading__spinner" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public — redirect root to /login */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login"  element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/join"   element={<JoinWorkspace />} />

      {/* Protected — requires active session, wrapped in AppShell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard"       element={<Dashboard />} />
          <Route path="/analytics"       element={<Analytics />} />
          <Route path="/settings"        element={<WorkspaceSettings />} />
          <Route path="/decisions/new"                                       element={<NewDecision />} />
          <Route path="/workspaces/:workspaceId/decisions/:decisionId"        element={<DecisionDetail />} />
        </Route>
      </Route>

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthGate />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#16162a',
            color: '#f1f0f5',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            fontSize: '0.875rem',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#0f0f1a' } },
          error:   { iconTheme: { primary: '#f87171', secondary: '#0f0f1a' } },
        }}
      />
    </BrowserRouter>
  )
}

export default App

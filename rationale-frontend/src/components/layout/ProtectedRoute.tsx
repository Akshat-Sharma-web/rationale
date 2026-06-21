import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

/**
 * Wraps protected routes. Redirects unauthenticated users to /login.
 * Shows nothing while the initial session check is still loading to
 * prevent a flash-redirect before Supabase resolves the stored token.
 */
export function ProtectedRoute() {
  const { session, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="auth-loading">
        <span className="auth-loading__spinner" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import type { User } from '../types'

/**
 * Maps a Supabase auth user to our app's User shape.
 */
function toAppUser(supabaseUser: NonNullable<Parameters<Parameters<typeof supabase.auth.onAuthStateChange>[0]>[1]>['user']): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    name: (supabaseUser.user_metadata?.name as string) ?? supabaseUser.email ?? '',
  }
}

/**
 * Subscribes to Supabase auth state changes and syncs them into the Zustand
 * auth store. Must be mounted once at the app root (inside <App />).
 */
export function useAuth() {
  const { setUser, setSession, clearAuth, setLoading } = useAuthStore()

  useEffect(() => {
    // Subscribe to future auth changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(toAppUser(session.user))
          setSession(session)
        } else {
          clearAuth()
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [setUser, setSession, clearAuth, setLoading])

  return useAuthStore()
}

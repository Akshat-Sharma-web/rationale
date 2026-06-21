import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { User } from '../types'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
}

interface AuthActions {
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setLoading: (isLoading: boolean) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  // ── State ──────────────────────────────────────────
  user: null,
  session: null,
  isLoading: true, // true on boot until onAuthStateChange fires

  // ── Actions ────────────────────────────────────────
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, session: null, isLoading: false }),
}))

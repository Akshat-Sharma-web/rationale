/**
 * Axios HTTP client pre-configured for the Rationale FastAPI backend.
 * Automatically attaches the Supabase JWT access token on every request.
 */
import axios from 'axios'
import { supabase } from '../lib/supabase'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000,
})

// Attach Authorization: Bearer <jwt> before every request
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// Normalise errors so callers get a consistent Error object
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err.response?.data?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : typeof detail === 'object'
        ? JSON.stringify(detail)
        : err.message ?? 'Request failed'
    return Promise.reject(new Error(message))
  },
)


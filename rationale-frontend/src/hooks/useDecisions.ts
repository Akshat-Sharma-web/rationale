import { useState, useEffect, useCallback, useRef } from 'react'
import { listDecisions, type DecisionFilters } from '../api/decisions'
import { useWorkspaceStore } from '../store/workspaceStore'
import type { Decision } from '../types'

interface UseDecisionsResult {
  decisions: Decision[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches decisions for the currently active workspace.
 * Re-fetches automatically when the workspace or filters change.
 * Filters changes are passed from the caller (Dashboard manages debounce).
 */
export function useDecisions(filters?: DecisionFilters): UseDecisionsResult {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Counter to trigger re-fetches imperatively
  const [tick, setTick] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!activeWorkspace) {
      setDecisions([])
      return
    }

    // Cancel any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    listDecisions(activeWorkspace.id, filters)
      .then((data) => {
        if (!controller.signal.aborted) setDecisions(data)
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted)
          setError(err.message ?? 'Failed to load decisions')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id, tick,
      filters?.status, filters?.tag, filters?.creator_id, filters?.keyword])

  return { decisions, loading, error, refetch }
}

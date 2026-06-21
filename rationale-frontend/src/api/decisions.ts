import { apiClient } from '../lib/apiClient'
import type { Decision } from '../types'

export interface DecisionFilters {
  status?: string
  tag?: string
  creator_id?: string
  keyword?: string
}

export interface DecisionCreatePayload {
  title: string
  context?: string
  rationale?: string
  status?: string
  tags?: string[]
  stakeholders?: string[]
  review_date?: string | null
  alternatives?: Array<{
    title: string
    description?: string
    pros?: string[]
    cons?: string[]
    is_selected?: boolean
  }>
}

export interface DecisionUpdatePayload extends Partial<DecisionCreatePayload> {}

// GET /api/v1/workspaces/{workspaceId}/decisions
export async function listDecisions(
  workspaceId: string,
  filters?: DecisionFilters,
): Promise<Decision[]> {
  const params: Record<string, string> = {}
  if (filters?.status)     params.status     = filters.status
  if (filters?.tag)        params.tag        = filters.tag
  if (filters?.creator_id) params.creator_id = filters.creator_id
  if (filters?.keyword)    params.keyword    = filters.keyword

  const { data } = await apiClient.get<Decision[]>(
    `/api/v1/workspaces/${workspaceId}/decisions`,
    { params },
  )
  return data
}

// GET /api/v1/workspaces/{workspaceId}/decisions/{decisionId}
export async function getDecision(
  workspaceId: string,
  decisionId: string,
): Promise<Decision> {
  const { data } = await apiClient.get<Decision>(
    `/api/v1/workspaces/${workspaceId}/decisions/${decisionId}`,
  )
  return data
}

// POST /api/v1/workspaces/{workspaceId}/decisions
export async function createDecision(
  workspaceId: string,
  payload: DecisionCreatePayload,
): Promise<Decision> {
  const { data } = await apiClient.post<Decision>(
    `/api/v1/workspaces/${workspaceId}/decisions`,
    payload,
  )
  return data
}

// PATCH /api/v1/workspaces/{workspaceId}/decisions/{decisionId}
export async function updateDecision(
  workspaceId: string,
  decisionId: string,
  payload: DecisionUpdatePayload,
): Promise<Decision> {
  const { data } = await apiClient.patch<Decision>(
    `/api/v1/workspaces/${workspaceId}/decisions/${decisionId}`,
    payload,
  )
  return data
}

// DELETE /api/v1/workspaces/{workspaceId}/decisions/{decisionId}
export async function deleteDecision(
  workspaceId: string,
  decisionId: string,
): Promise<void> {
  await apiClient.delete(
    `/api/v1/workspaces/${workspaceId}/decisions/${decisionId}`,
  )
}

// ── Outcome Reviews ────────────────────────────────────────────────────────────

export interface ReviewPayload {
  actual_outcome: string
  quality_score: number  // 1–5
  lessons_learned?: string
}

// POST /api/v1/decisions/{decisionId}/review
export async function submitReview(
  decisionId: string,
  payload: ReviewPayload,
): Promise<import('../types').OutcomeReview> {
  const { data } = await apiClient.post(
    `/api/v1/decisions/${decisionId}/review`,
    payload,
  )
  return data
}

// GET /api/v1/decisions/{decisionId}/review
export async function getReview(
  decisionId: string,
): Promise<import('../types').OutcomeReview | null> {
  try {
    const { data } = await apiClient.get(
      `/api/v1/decisions/${decisionId}/review`,
    )
    return data
  } catch {
    return null
  }
}

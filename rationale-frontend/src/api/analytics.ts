import { apiClient } from '../lib/apiClient'
import type { AnalyticsSummary } from '../types'

/**
 * GET /api/v1/workspaces/{workspaceId}/analytics
 * Returns the full aggregated analytics summary for a workspace.
 */
export async function getAnalytics(workspaceId: string): Promise<AnalyticsSummary> {
  const { data } = await apiClient.get<AnalyticsSummary>(
    `/api/v1/workspaces/${workspaceId}/analytics`,
  )
  return data
}

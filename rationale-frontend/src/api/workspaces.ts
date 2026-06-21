import { apiClient } from '../lib/apiClient'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WorkspaceMember {
  user_id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
}

export interface PendingInvitation {
  id: string
  email: string
  role: string
  expires_at: string
  created_at: string
}

export interface JoinResponse {
  workspace_id: string
  workspace_name: string
  role: string
}

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /api/v1/workspaces/{workspaceId}/members */
export async function getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data } = await apiClient.get<WorkspaceMember[]>(
    `/api/v1/workspaces/${workspaceId}/members`,
  )
  return data
}

/** POST /api/v1/workspaces/{workspaceId}/invite */
export async function inviteMember(
  workspaceId: string,
  email: string,
  role: string,
): Promise<PendingInvitation> {
  const { data } = await apiClient.post<PendingInvitation>(
    `/api/v1/workspaces/${workspaceId}/invite`,
    { email, role },
  )
  return data
}

/** POST /api/v1/workspaces/join  — accepts invitation token */
export async function joinWorkspace(token: string): Promise<JoinResponse> {
  const { data } = await apiClient.post<JoinResponse>(
    `/api/v1/workspaces/join`,
    { token },
  )
  return data
}

/** PATCH /api/v1/workspaces/{workspaceId}/members/{userId} — change role */
export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: string,
): Promise<void> {
  await apiClient.patch(
    `/api/v1/workspaces/${workspaceId}/members/${userId}`,
    { role },
  )
}

/** DELETE /api/v1/workspaces/{workspaceId}/members/{userId} */
export async function removeMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  await apiClient.delete(
    `/api/v1/workspaces/${workspaceId}/members/${userId}`,
  )
}

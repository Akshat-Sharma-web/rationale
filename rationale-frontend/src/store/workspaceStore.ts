import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Workspace } from '../types'

interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
}

interface WorkspaceActions {
  setWorkspaces: (workspaces: Workspace[]) => void
  setActiveWorkspace: (workspace: Workspace | null) => void
  clearWorkspaces: () => void
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  persist(
    (set) => ({
      workspaces: [],
      activeWorkspace: null,

      setWorkspaces: (workspaces) =>
        set((s) => ({
          workspaces,
          // Auto-select first workspace if none active
          activeWorkspace:
            s.activeWorkspace ?? (workspaces[0] ?? null),
        })),

      setActiveWorkspace: (workspace) =>
        set({ activeWorkspace: workspace }),

      clearWorkspaces: () =>
        set({ workspaces: [], activeWorkspace: null }),
    }),
    {
      name: 'rationale-workspace',
      partialize: (s) => ({ activeWorkspace: s.activeWorkspace }),
    },
  ),
)

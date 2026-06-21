import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { signOut } from '../../api/auth'
import toast from 'react-hot-toast'
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  ChevronDown,
  LogOut,
  Zap,
  Check,
} from 'lucide-react'
import { useState } from 'react'

interface Workspace {
  id: string
  name: string
}

interface SidebarProps {
  workspaces?: Workspace[]
  activeWorkspace?: Workspace | null
  onWorkspaceChange?: (ws: Workspace) => void
  onClose?: () => void
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analytics',  icon: BarChart3 },
  { to: '/settings',  label: 'Settings',   icon: Settings },
]

export function Sidebar({
  workspaces = [],
  activeWorkspace = null,
  onWorkspaceChange,
  onClose,
}: SidebarProps) {
  const user      = useAuthStore((s) => s.user)
  const navigate  = useNavigate()
  const [wsOpen, setWsOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleSignOut() {
    try {
      setLoggingOut(true)
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      toast.error('Failed to sign out')
    } finally {
      setLoggingOut(false)
    }
  }

  function handleNavClick() {
    onClose?.() // collapse on mobile
  }

  return (
    <aside className="sidebar">
      {/* ── Logo ─────────────────────────────────────────── */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">
          <Zap size={16} strokeWidth={2.5} />
        </div>
        <div>
          <div className="sidebar__logo-name">Rationale</div>
          <div className="sidebar__logo-subtitle">Decision Intelligence</div>
        </div>
      </div>

      {/* ── Workspace Switcher ────────────────────────────── */}
      {activeWorkspace && (
        <div className="sidebar__ws-switcher">
          <button
            className="sidebar__ws-btn"
            onClick={() => setWsOpen((o) => !o)}
            aria-expanded={wsOpen}
            aria-haspopup="listbox"
          >
            <span className="sidebar__ws-avatar">
              {activeWorkspace.name.charAt(0).toUpperCase()}
            </span>
            <span className="sidebar__ws-name">{activeWorkspace.name}</span>
            <ChevronDown
              size={14}
              className={`sidebar__ws-chevron ${wsOpen ? 'sidebar__ws-chevron--open' : ''}`}
            />
          </button>

          {wsOpen && workspaces.length > 0 && (
            <ul className="sidebar__ws-dropdown" role="listbox">
              {workspaces.map((ws) => (
                <li key={ws.id}>
                  <button
                    className="sidebar__ws-option"
                    role="option"
                    aria-selected={ws.id === activeWorkspace.id}
                    onClick={() => {
                      onWorkspaceChange?.(ws)
                      setWsOpen(false)
                    }}
                  >
                    <span className="sidebar__ws-option-name">{ws.name}</span>
                    {ws.id === activeWorkspace.id && (
                      <Check size={13} className="sidebar__ws-option-check" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="sidebar__nav" aria-label="Primary navigation">
        <ul>
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `sidebar__nav-link ${isActive ? 'sidebar__nav-link--active' : ''}`
                }
                onClick={handleNavClick}
                id={`nav-${label.toLowerCase()}`}
              >
                <Icon size={18} strokeWidth={1.75} className="sidebar__nav-icon" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── User section ─────────────────────────────────── */}
      <div className="sidebar__footer">
        <div className="sidebar__user">
          <div className="sidebar__user-avatar">
            {(user?.name ?? user?.email ?? 'U').charAt(0).toUpperCase()}
          </div>
          <div className="sidebar__user-info">
            <p className="sidebar__user-name">{user?.name ?? 'User'}</p>
            <p className="sidebar__user-email">{user?.email ?? ''}</p>
          </div>
        </div>
        <button
          className="sidebar__logout"
          onClick={handleSignOut}
          disabled={loggingOut}
          id="btn-logout"
          title="Sign out"
        >
          <LogOut size={16} strokeWidth={1.75} />
          <span>{loggingOut ? 'Signing out…' : 'Logout'}</span>
        </button>
      </div>
    </aside>
  )
}

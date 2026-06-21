import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Users, Mail, Trash2, AlertCircle, Clock,
  ShieldCheck, Send, CheckCircle2,
} from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { useAuthStore }      from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  getMembers, inviteMember,
  updateMemberRole, removeMember,
  type WorkspaceMember, type PendingInvitation,
} from '../api/workspaces'

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────

const ROLE_OPTIONS = ['admin', 'member', 'viewer'] as const
type MutableRole = typeof ROLE_OPTIONS[number]

const ROLE_META: Record<string, { label: string; cls: string }> = {
  owner:  { label: 'Owner',  cls: 'role-badge--owner' },
  admin:  { label: 'Admin',  cls: 'role-badge--admin' },
  member: { label: 'Member', cls: 'role-badge--member' },
  viewer: { label: 'Viewer', cls: 'role-badge--viewer' },
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function initials(name: string, email: string): string {
  const src = name.trim() || email.trim()
  const parts = src.split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : src.slice(0, 2).toUpperCase()
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function isExpired(iso: string) {
  return new Date(iso) < new Date()
}

// ─────────────────────────────────────────────────────────────
//  Members tab
// ─────────────────────────────────────────────────────────────

function MembersTab({
  workspaceId,
  isAdmin,
  currentUserId,
}: {
  workspaceId: string
  isAdmin: boolean
  currentUserId: string
}) {
  const [members, setMembers]   = useState<WorkspaceMember[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState<string | null>(null)  // userId being actioned

  useEffect(() => {
    setLoading(true)
    getMembers(workspaceId)
      .then(setMembers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [workspaceId])

  async function handleRoleChange(userId: string, role: string) {
    setBusy(userId)
    try {
      await updateMemberRole(workspaceId, userId, role)
      setMembers((ms) =>
        ms.map((m) => m.user_id === userId ? { ...m, role: role as WorkspaceMember['role'] } : m),
      )
      toast.success('Role updated')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this workspace?`)) return
    setBusy(userId)
    try {
      await removeMember(workspaceId, userId)
      setMembers((ms) => ms.filter((m) => m.user_id !== userId))
      toast.success(`${name} removed`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Removal failed')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="settings-members__loading">
        {[1,2,3].map((i) => (
          <div key={i} className="member-row member-row--skeleton">
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton" style={{ height: 13, width: '40%' }} />
              <div className="skeleton" style={{ height: 12, width: '60%' }} />
            </div>
            <div className="skeleton" style={{ height: 22, width: 60, borderRadius: 99 }} />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="settings-error">
        <AlertCircle size={16} />
        {error}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="dashboard__empty" style={{ padding: '3rem 0' }}>
        <div className="dashboard__empty-icon"><Users size={32} strokeWidth={1.25} /></div>
        <h3 className="dashboard__empty-title">No members yet</h3>
        <p className="dashboard__empty-body">Invite people using the Invite tab.</p>
      </div>
    )
  }

  return (
    <div className="settings-members">
      {/* Header row */}
      <div className="member-table-head">
        <span>Member</span>
        <span>Role</span>
        <span>Joined</span>
        {isAdmin && <span />}
      </div>

      {members.map((m) => {
        const meta = ROLE_META[m.role] ?? ROLE_META.member
        const isSelf = m.user_id === currentUserId
        const isOwner = m.role === 'owner'
        const canAction = isAdmin && !isSelf && !isOwner

        return (
          <div key={m.user_id} className="member-row">
            {/* Avatar + info */}
            <div className="member-row__info">
              <div className="member-avatar">
                {initials(m.name, m.email)}
              </div>
              <div>
                <p className="member-row__name">
                  {m.name || '—'}
                  {isSelf && <span className="member-row__you">You</span>}
                </p>
                <p className="member-row__email">{m.email}</p>
              </div>
            </div>

            {/* Role badge / dropdown */}
            <div className="member-row__role">
              {canAction ? (
                <select
                  className="role-select"
                  value={m.role}
                  disabled={busy === m.user_id}
                  onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                  aria-label={`Change role for ${m.name}`}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              ) : (
                <span className={`role-badge ${meta.cls}`}>{meta.label}</span>
              )}
            </div>

            {/* Joined date */}
            <span className="member-row__date">{fmtDate(m.joined_at)}</span>

            {/* Remove button */}
            {isAdmin && (
              <div className="member-row__actions">
                {canAction && (
                  <button
                    className="member-remove-btn"
                    onClick={() => handleRemove(m.user_id, m.name || m.email)}
                    disabled={busy === m.user_id}
                    aria-label={`Remove ${m.name}`}
                    title="Remove from workspace"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Invite tab
// ─────────────────────────────────────────────────────────────

function InviteTab({ workspaceId }: { workspaceId: string }) {
  const [email, setEmail]       = useState('')
  const [role, setRole]         = useState<MutableRole>('member')
  const [emailError, setEmailError] = useState('')
  const [submitting, setSub]    = useState(false)
  const [pending, setPending]   = useState<PendingInvitation[]>([])
  const [sent, setSent]         = useState(false)

  async function handleInvite() {
    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address')
      return
    }
    setEmailError('')
    setSub(true)
    try {
      const inv = await inviteMember(workspaceId, email.trim().toLowerCase(), role)
      setPending((p) => [inv, ...p])
      setEmail('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
      toast.success(`Invitation sent to ${email}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Invitation failed')
    } finally {
      setSub(false)
    }
  }

  return (
    <div className="invite-tab">
      {/* Invite form */}
      <div className="invite-form">
        <h3 className="invite-form__title">Invite a team member</h3>
        <p className="invite-form__hint">
          They'll receive an email with a link to join this workspace.
        </p>

        <div className="invite-form__row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="invite-email" className="form-label">Email address</label>
            <input
              id="invite-email"
              type="email"
              className={`form-input ${emailError ? 'form-input--error' : ''}`}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              placeholder="colleague@company.com"
              autoComplete="off"
            />
            {emailError && <p className="form-error">{emailError}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="invite-role" className="form-label">Role</label>
            <select
              id="invite-role"
              className="filter-select"
              value={role}
              onChange={(e) => setRole(e.target.value as MutableRole)}
              style={{ padding: '0.625rem 1.25rem 0.625rem 0.875rem' }}
            >
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="form-field" style={{ alignSelf: 'flex-end' }}>
            <button
              className="btn-next"
              onClick={handleInvite}
              disabled={submitting || !email}
              id="btn-send-invite"
              style={{ padding: '0.625rem 1.25rem' }}
            >
              {sent ? (
                <><CheckCircle2 size={15} /> Sent!</>
              ) : submitting ? (
                <><span className="btn-spinner" style={{ width:14, height:14 }} /> Sending…</>
              ) : (
                <><Send size={15} /> Send</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pending invitations list */}
      {pending.length > 0 && (
        <div className="pending-invites">
          <h4 className="pending-invites__title">Sent invitations</h4>
          {pending.map((inv) => {
            const expired = isExpired(inv.expires_at)
            return (
              <div key={inv.id} className={`invite-row ${expired ? 'invite-row--expired' : ''}`}>
                <Mail size={15} className="invite-row__icon" />
                <div className="invite-row__info">
                  <span className="invite-row__email">{inv.email}</span>
                  <span className="invite-row__role">{inv.role}</span>
                </div>
                <div className="invite-row__expiry">
                  <Clock size={12} />
                  {expired ? 'Expired' : `Expires ${fmtDate(inv.expires_at)}`}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pending.length === 0 && (
        <div className="pending-invites__empty">
          <ShieldCheck size={20} />
          Invitations you send will appear here.
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main page
// ─────────────────────────────────────────────────────────────

type Tab = 'members' | 'invite'

export function WorkspaceSettings() {
  const workspace   = useWorkspaceStore((s) => s.activeWorkspace)
  const currentUser = useAuthStore((s) => s.user)
  const isAdmin     = workspace?.role === 'admin' || workspace?.role === 'owner'
  const [tab, setTab] = useState<Tab>('members')

  if (!workspace) {
    return (
      <div>
        <TopBar title="Workspace Settings" />
        <div className="settings-error">
          <AlertCircle size={16} /> No workspace selected.
        </div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <TopBar title="Workspace Settings" />

      {/* Workspace name banner */}
      <div className="settings-banner">
        <div className="settings-banner__avatar">
          {workspace.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="settings-banner__name">{workspace.name}</h2>
          <p className="settings-banner__slug">/{workspace.slug}</p>
        </div>
        <span className={`role-badge ${ROLE_META[workspace.role]?.cls}`} style={{ marginLeft: 'auto' }}>
          {ROLE_META[workspace.role]?.label}
        </span>
      </div>

      {/* Tab bar */}
      <div className="settings-tabs" role="tablist">
        <button
          role="tab"
          id="tab-members"
          aria-selected={tab === 'members'}
          className={`settings-tab ${tab === 'members' ? 'settings-tab--active' : ''}`}
          onClick={() => setTab('members')}
        >
          <Users size={15} strokeWidth={2} />
          Members
        </button>
        {isAdmin && (
          <button
            role="tab"
            id="tab-invite"
            aria-selected={tab === 'invite'}
            className={`settings-tab ${tab === 'invite' ? 'settings-tab--active' : ''}`}
            onClick={() => setTab('invite')}
          >
            <Mail size={15} strokeWidth={2} />
            Invite
          </button>
        )}
      </div>

      {/* Tab panels */}
      <div className="settings-panel">
        {tab === 'members' && (
          <MembersTab
            workspaceId={workspace.id}
            isAdmin={isAdmin}
            currentUserId={currentUser?.id ?? ''}
          />
        )}
        {tab === 'invite' && isAdmin && (
          <InviteTab workspaceId={workspace.id} />
        )}
      </div>
    </div>
  )
}

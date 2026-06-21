import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CheckCircle2, XCircle, Loader } from 'lucide-react'
import { joinWorkspace } from '../api/workspaces'
import { useWorkspaceStore } from '../store/workspaceStore'

type State = 'loading' | 'success' | 'error'

export function JoinWorkspace() {
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const setActiveWs     = useWorkspaceStore((s) => s.setActiveWorkspace)
  const token           = searchParams.get('token') ?? ''

  const [state, setState]     = useState<State>('loading')
  const [message, setMessage] = useState('')
  const [wsName, setWsName]   = useState('')

  useEffect(() => {
    if (!token) {
      setState('error')
      setMessage('Invalid or missing invitation token.')
      return
    }

    joinWorkspace(token)
      .then((res) => {
        setWsName(res.workspace_name)
        setState('success')
        // Set the newly joined workspace as active
        setActiveWs({
          id:   res.workspace_id,
          name: res.workspace_name,
          slug: '',
          role: res.role as 'owner' | 'admin' | 'member' | 'viewer',
        })
        toast.success(`Welcome to ${res.workspace_name}!`)
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
      })
      .catch((err: Error) => {
        setState('error')
        // Surface expiry vs other errors clearly
        const isExpired =
          err.message.toLowerCase().includes('expir') ||
          err.message.toLowerCase().includes('410')
        setMessage(
          isExpired
            ? 'This invitation has expired. Please ask an admin to send a new one.'
            : (err.message || 'Failed to join workspace.'),
        )
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="join-page">
      <div className="join-card">
        {/* Logo */}
        <div className="join-card__logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          <span>Rationale</span>
        </div>

        {/* Loading */}
        {state === 'loading' && (
          <div className="join-card__state">
            <Loader size={36} className="join-card__spinner" />
            <h2 className="join-card__heading">Joining workspace…</h2>
            <p className="join-card__body">Validating your invitation token.</p>
          </div>
        )}

        {/* Success */}
        {state === 'success' && (
          <div className="join-card__state">
            <CheckCircle2 size={40} className="join-card__icon join-card__icon--success" />
            <h2 className="join-card__heading">You're in!</h2>
            <p className="join-card__body">
              You've joined <strong>{wsName}</strong>. Redirecting you to the dashboard…
            </p>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="join-card__state">
            <XCircle size={40} className="join-card__icon join-card__icon--error" />
            <h2 className="join-card__heading">Invitation failed</h2>
            <p className="join-card__body">{message}</p>
            <button
              className="btn-primary"
              style={{ marginTop: '1.25rem', width: '100%' }}
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

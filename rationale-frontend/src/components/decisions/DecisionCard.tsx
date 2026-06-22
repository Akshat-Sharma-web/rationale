import { useNavigate } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import type { Decision } from '../../types'

type DecisionStatus = Decision['status']

const STATUS_META: Record
  DecisionStatus,
  { label: string; className: string }
> = {
  draft:      { label: 'Draft',      className: 'badge--draft' },
  active:     { label: 'Active',     className: 'badge--active' },
  reviewed:   { label: 'Reviewed',   className: 'badge--reviewed' },
  superseded: { label: 'Superseded', className: 'badge--superseded' },
  archived:   { label: 'Archived',   className: 'badge--archived' },
}

interface DecisionCardProps {
  decision: Decision
  workspaceId: string
}

export function DecisionCard({ decision, workspaceId }: DecisionCardProps) {
  const navigate = useNavigate()
  const meta = STATUS_META[decision.status] ?? STATUS_META.draft

  const reviewDate = decision.review_date
    ? new Date(decision.review_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  const isPastDue =
    decision.review_date &&
    decision.status !== 'reviewed' &&
    new Date(decision.review_date) < new Date()

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    navigate(`/workspaces/${workspaceId}/decisions/${decision.id}/edit`)
  }

  return (
    <article
      className="decision-card"
      onClick={() =>
        navigate(`/workspaces/${workspaceId}/decisions/${decision.id}`)
      }
      role="button"
      tabIndex={0}
      aria-label={`View decision: ${decision.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ')
          navigate(`/workspaces/${workspaceId}/decisions/${decision.id}`)
      }}
    >
      <div className="decision-card__header">
        <span className={`badge ${meta.className}`}>{meta.label}</span>
        {isPastDue && (
          <span className="badge badge--overdue" title="Review date has passed">
            Past Due
          </span>
        )}
        <button
          className="decision-card__edit-btn"
          onClick={handleEdit}
          aria-label={`Edit decision: ${decision.title}`}
          title="Edit decision"
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      </div>

      <h2 className="decision-card__title">{decision.title}</h2>

      {decision.context && (
        <p className="decision-card__context">{decision.context}</p>
      )}

      {decision.tags.length > 0 && (
        <div className="decision-card__tags">
          {decision.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="tag-chip">{tag}</span>
          ))}
          {decision.tags.length > 4 && (
            <span className="tag-chip tag-chip--more">
              +{decision.tags.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="decision-card__footer">
        <span className="decision-card__meta">
          {new Date(decision.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        {reviewDate && (
          <span
            className={`decision-card__review-date ${isPastDue ? 'decision-card__review-date--overdue' : ''}`}
          >
            Review {reviewDate}
          </span>
        )}
      </div>
    </article>
  )
}

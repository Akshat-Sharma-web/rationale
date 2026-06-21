import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Pencil, Star, CheckCircle2, CalendarClock,
  User, Clock, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import { getDecision, submitReview, type ReviewPayload } from '../api/decisions'
import { useAuthStore } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import type { Decision, Alternative, OutcomeReview } from '../types'

// ─────────────────────────────────────────────────────────────
//  Status badge
// ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:      { label: 'Draft',      cls: 'badge--draft' },
  active:     { label: 'Active',     cls: 'badge--active' },
  reviewed:   { label: 'Reviewed',   cls: 'badge--reviewed' },
  superseded: { label: 'Superseded', cls: 'badge--superseded' },
  archived:   { label: 'Archived',   cls: 'badge--archived' },
}

// ─────────────────────────────────────────────────────────────
//  Star selector
// ─────────────────────────────────────────────────────────────

function StarSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const [hover, setHover] = useState(0)
  return (
    <div className="star-selector" role="radiogroup" aria-label="Quality score">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={`star-selector__btn ${(hover || value) >= n ? 'star-selector__btn--on' : ''}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
        >
          <Star size={24} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Static star display
// ─────────────────────────────────────────────────────────────

function StarDisplay({ score }: { score: number }) {
  return (
    <div className="star-display" aria-label={`${score} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={18}
          strokeWidth={1.75}
          className={n <= score ? 'star-display__on' : 'star-display__off'}
        />
      ))}
      <span className="star-display__label">{score}/5</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Alternative card
// ─────────────────────────────────────────────────────────────

function AlternativeDetailCard({ alt }: { alt: Alternative }) {
  return (
    <div className={`alt-detail-card ${alt.is_selected ? 'alt-detail-card--selected' : ''}`}>
      <div className="alt-detail-card__header">
        <h4 className="alt-detail-card__title">{alt.title}</h4>
        {alt.is_selected && (
          <span className="alt-detail-card__chosen">
            <CheckCircle2 size={14} strokeWidth={2.5} />
            Chosen
          </span>
        )}
      </div>
      {alt.description && (
        <p className="alt-detail-card__desc">{alt.description}</p>
      )}
      {(alt.pros.length > 0 || alt.cons.length > 0) && (
        <div className="alt-detail-card__pros-cons">
          {alt.pros.length > 0 && (
            <div>
              <p className="alt-detail-card__pros-label">
                <ThumbsUp size={12} /> Pros
              </p>
              <ul className="alt-detail-card__list">
                {alt.pros.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {alt.cons.length > 0 && (
            <div>
              <p className="alt-detail-card__cons-label">
                <ThumbsDown size={12} /> Cons
              </p>
              <ul className="alt-detail-card__list">
                {alt.cons.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Outcome review card (read-only)
// ─────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: OutcomeReview }) {
  return (
    <div className="review-card">
      <div className="review-card__header">
        <CheckCircle2 size={18} className="review-card__icon" />
        <h3 className="review-card__title">Outcome Review</h3>
        <span className="review-card__date">
          {new Date(review.reviewed_at).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </span>
      </div>

      <div className="detail-section__body">
        <p className="detail-prose">{review.actual_outcome}</p>
      </div>

      <StarDisplay score={review.quality_score} />

      {review.lessons_learned && (
        <div className="review-card__lessons">
          <p className="review-card__lessons-label">Lessons Learned</p>
          <p className="detail-prose">{review.lessons_learned}</p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Submit review form (inline)
// ─────────────────────────────────────────────────────────────

function SubmitReviewForm({
  decisionId,
  onSuccess,
}: {
  decisionId: string
  onSuccess: (review: OutcomeReview) => void
}) {
  const [outcome, setOutcome]   = useState('')
  const [score, setScore]       = useState(0)
  const [lessons, setLessons]   = useState('')
  const [submitting, setSub]    = useState(false)
  const [errors, setErrors]     = useState<Record<string, string>>({})

  async function handleSubmit() {
    const errs: Record<string, string> = {}
    if (!outcome.trim()) errs.outcome = 'Actual outcome is required'
    if (score === 0)     errs.score   = 'Please select a quality score'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSub(true)
    try {
      const payload: ReviewPayload = {
        actual_outcome:  outcome.trim(),
        quality_score:   score,
        lessons_learned: lessons.trim() || undefined,
      }
      const review = await submitReview(decisionId, payload)
      toast.success('Outcome review submitted!')
      onSuccess(review)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSub(false)
    }
  }

  return (
    <div className="review-form">
      <div className="review-form__header">
        <CalendarClock size={18} className="review-form__icon" />
        <h3 className="review-form__title">Submit Outcome Review</h3>
      </div>
      <p className="review-form__hint">
        The review date for this decision has passed. How did it turn out?
      </p>

      <div className="form-field">
        <label htmlFor="rf-outcome" className="form-label">
          Actual Outcome <span className="form-required">*</span>
        </label>
        <textarea
          id="rf-outcome"
          className={`form-textarea ${errors.outcome ? 'form-textarea--error' : ''}`}
          value={outcome}
          onChange={(e) => { setOutcome(e.target.value); setErrors((x) => ({...x, outcome: ''})) }}
          placeholder="What actually happened as a result of this decision?"
          rows={4}
        />
        {errors.outcome && <p className="form-error">{errors.outcome}</p>}
      </div>

      <div className="form-field">
        <label className="form-label">
          Quality Score <span className="form-required">*</span>
          <span className="form-label__hint"> — How good was this decision in hindsight?</span>
        </label>
        <StarSelector value={score} onChange={(n) => { setScore(n); setErrors((x) => ({...x, score: ''})) }} />
        {errors.score && <p className="form-error">{errors.score}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="rf-lessons" className="form-label">
          Lessons Learned
          <span className="form-label__hint"> — optional</span>
        </label>
        <textarea
          id="rf-lessons"
          className="form-textarea"
          value={lessons}
          onChange={(e) => setLessons(e.target.value)}
          placeholder="What would you do differently next time?"
          rows={3}
        />
      </div>

      <button
        type="button"
        className="btn-submit"
        onClick={handleSubmit}
        disabled={submitting}
        id="btn-submit-review"
      >
        {submitting ? (
          <span className="btn-loading"><span className="btn-spinner" />Submitting…</span>
        ) : 'Submit Review'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Page skeleton
// ─────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="decision-detail">
      <div className="detail-header">
        <div className="skeleton" style={{ height: 14, width: 120 }} />
        <div className="skeleton" style={{ height: 36, width: '60%', marginTop: 12 }} />
        <div className="skeleton skeleton--badge" style={{ marginTop: 12 }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="detail-section" style={{ marginTop: 24 }}>
          <div className="skeleton" style={{ height: 14, width: 100 }} />
          <div className="skeleton" style={{ height: 13, width: '100%', marginTop: 10 }} />
          <div className="skeleton" style={{ height: 13, width: '80%', marginTop: 6 }} />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main page component
// ─────────────────────────────────────────────────────────────

export function DecisionDetail() {
  const { workspaceId, decisionId } = useParams<{
    workspaceId: string
    decisionId: string
  }>()
  const navigate   = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const workspace   = useWorkspaceStore((s) => s.activeWorkspace)

  const [decision, setDecision]   = useState<Decision | null>(null)
  const [review, setReview]       = useState<OutcomeReview | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Fetch decision (includes alternatives + outcome_reviews from backend)
  useEffect(() => {
    if (!workspaceId || !decisionId) return
    setLoading(true)
    getDecision(workspaceId, decisionId)
      .then((d) => {
        setDecision(d)
        // Backend may embed reviews inside the decision object
        const embedded = d.outcome_reviews?.[0] ?? null
        setReview(embedded)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [workspaceId, decisionId])

  // Update title tag
  useEffect(() => {
    if (decision) document.title = `${decision.title} — Rationale`
    return () => { document.title = 'Rationale — Decision Intelligence' }
  }, [decision])

  // ── Derived state ─────────────────────────────────────────

  const isCreator  = currentUser?.id === decision?.created_by?.id
  const isAdmin    = workspace?.role === 'admin' || workspace?.role === 'owner'
  const canEdit    = isCreator || isAdmin

  const reviewDatePast = decision?.review_date
    ? new Date(decision.review_date) <= new Date()
    : false

  const showReviewForm =
    reviewDatePast &&
    decision?.status !== 'reviewed' &&
    !review

  const showReviewCard =
    decision?.status === 'reviewed' || !!review

  const statusMeta = STATUS_META[decision?.status ?? 'draft']

  // ── Render ────────────────────────────────────────────────

  if (loading) return <DetailSkeleton />

  if (error) {
    return (
      <div className="detail-error">
        <p>{error}</p>
        <button className="btn-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Go back
        </button>
      </div>
    )
  }

  if (!decision) return null

  const createdDate = new Date(decision.created_at).toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  const reviewDateStr = decision.review_date
    ? new Date(decision.review_date).toLocaleDateString(undefined, {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  return (
    <div className="decision-detail">

      {/* ── Back link ──────────────────────────────────────── */}
      <Link to="/dashboard" className="detail-back">
        <ArrowLeft size={15} strokeWidth={2} />
        All Decisions
      </Link>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="detail-header">
        <div className="detail-header__top">
          <span className={`badge ${statusMeta.cls}`}>{statusMeta.label}</span>
          {canEdit && (
            <button
              className="detail-edit-btn"
              onClick={() => navigate(`/decisions/${decisionId}/edit`)}
              id="btn-edit-decision"
            >
              <Pencil size={14} strokeWidth={2} />
              Edit
            </button>
          )}
        </div>

        <h1 className="detail-title">{decision.title}</h1>

        {/* Tags */}
        {decision.tags.length > 0 && (
          <div className="detail-tags">
            {decision.tags.map((t) => (
              <span key={t} className="tag-chip">{t}</span>
            ))}
          </div>
        )}

        {/* Meta row */}
        <div className="detail-meta">
          <span className="detail-meta__item">
            <User size={13} strokeWidth={2} />
            {decision.created_by?.name ?? decision.created_by?.email ?? 'Unknown'}
          </span>
          <span className="detail-meta__sep">·</span>
          <span className="detail-meta__item">
            <Clock size={13} strokeWidth={2} />
            {createdDate}
          </span>
          {reviewDateStr && (
            <>
              <span className="detail-meta__sep">·</span>
              <span className={`detail-meta__item ${reviewDatePast && decision.status !== 'reviewed' ? 'detail-meta__item--overdue' : ''}`}>
                <CalendarClock size={13} strokeWidth={2} />
                Review {reviewDateStr}
              </span>
            </>
          )}
        </div>
      </header>

      {/* ── Context ────────────────────────────────────────── */}
      {decision.context && (
        <section className="detail-section">
          <h2 className="detail-section__label">Context</h2>
          <p className="detail-prose">{decision.context}</p>
        </section>
      )}

      {/* ── Alternatives ───────────────────────────────────── */}
      {decision.alternatives?.length > 0 && (
        <section className="detail-section">
          <h2 className="detail-section__label">Alternatives Considered</h2>
          <div className="alt-detail-grid">
            {decision.alternatives.map((alt) => (
              <AlternativeDetailCard key={alt.id} alt={alt} />
            ))}
          </div>
        </section>
      )}

      {/* ── Rationale ──────────────────────────────────────── */}
      {decision.rationale && (
        <section className="detail-section">
          <h2 className="detail-section__label">Rationale</h2>
          <p className="detail-prose">{decision.rationale}</p>
        </section>
      )}

      {/* ── Stakeholders ───────────────────────────────────── */}
      {decision.stakeholders?.length > 0 && (
        <section className="detail-section">
          <h2 className="detail-section__label">Stakeholders</h2>
          <div className="detail-tags">
            {decision.stakeholders.map((s) => (
              <span key={s} className="stakeholder-chip">{s}</span>
            ))}
          </div>
        </section>
      )}

      {/* ── Review section ──────────────────────────────────── */}
      {showReviewCard && review && (
        <section className="detail-section">
          <ReviewCard review={review} />
        </section>
      )}

      {showReviewForm && decisionId && (
        <section className="detail-section">
          <SubmitReviewForm
            decisionId={decisionId}
            onSuccess={(r) => {
              setReview(r)
              // Optimistically mark as reviewed
              setDecision((d) => d ? { ...d, status: 'reviewed' } : d)
            }}
          />
        </section>
      )}

    </div>
  )
}

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Trash2, Check, ChevronRight, ChevronLeft, X } from 'lucide-react'
import { createDecision, getDecision, updateDecision } from '../api/decisions'
import { useWorkspaceStore } from '../store/workspaceStore'

interface AlternativeForm {
  id: string
  title: string
  description: string
  pros: string[]
  cons: string[]
  isSelected: boolean
}

interface FormState {
  title: string
  context: string
  tags: string[]
  alternatives: AlternativeForm[]
  rationale: string
  stakeholders: string[]
  reviewDate: string
}

interface StepErrors {
  [key: string]: string
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function makeAlt(): AlternativeForm {
  return { id: uid(), title: '', description: '', pros: [], cons: [], isSelected: false }
}

const STEP_LABELS = ['The Decision', 'Alternatives', 'Rationale']

function TagInput({
  id,
  values,
  onChange,
  placeholder,
  error,
}: {
  id: string
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  error?: string
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    const val = input.trim()
    if (val && !values.includes(val)) onChange([...values, val])
    setInput('')
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !input && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div>
      <div
        className={`tag-input ${error ? 'tag-input--error' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((v) => (
          <span key={v} className="tag-input__chip">
            {v}
            <button
              type="button"
              className="tag-input__remove"
              onClick={(e) => { e.stopPropagation(); onChange(values.filter((x) => x !== v)) }}
              aria-label={`Remove ${v}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          className="tag-input__field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : ''}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

function InlineListInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  function commit() {
    const val = input.trim()
    if (val) onChange([...values, val])
    setInput('')
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    if (e.key === 'Backspace' && !input && values.length > 0)
      onChange(values.slice(0, -1))
  }

  return (
    <div className="inline-list-input">
      <ul className="inline-list-input__list">
        {values.map((v, i) => (
          <li key={i} className="inline-list-input__item">
            <span>{v}</span>
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="inline-list-input__remove"
              aria-label="Remove"
            >
              <X size={11} />
            </button>
          </li>
        ))}
      </ul>
      <input
        ref={ref}
        className="inline-list-input__field"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={placeholder}
      />
    </div>
  )
}

function AlternativeCard({
  alt,
  index,
  isSelected,
  onSelect,
  onChange,
  onRemove,
  error,
}: {
  alt: AlternativeForm
  index: number
  isSelected: boolean
  onSelect: () => void
  onChange: (updated: AlternativeForm) => void
  onRemove: () => void
  error?: string
}) {
  function set<K extends keyof AlternativeForm>(key: K, val: AlternativeForm[K]) {
    onChange({ ...alt, [key]: val })
  }

  return (
    <div className={`alt-card ${isSelected ? 'alt-card--selected' : ''}`}>
      <div className="alt-card__header">
        <button
          type="button"
          className={`alt-card__select-btn ${isSelected ? 'alt-card__select-btn--active' : ''}`}
          onClick={onSelect}
          title="Mark as chosen alternative"
          aria-label={isSelected ? 'Chosen alternative' : 'Choose this alternative'}
        >
          {isSelected ? <Check size={13} strokeWidth={2.5} /> : null}
        </button>
        <span className="alt-card__label">Alternative {index + 1}</span>
        {isSelected && <span className="alt-card__chosen-badge">Chosen</span>}
        <button
          type="button"
          className="alt-card__remove"
          onClick={onRemove}
          aria-label="Remove alternative"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="form-field">
        <label className="form-label">
          Title <span className="form-required">*</span>
        </label>
        <input
          className={`form-input ${error ? 'form-input--error' : ''}`}
          value={alt.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Use PostgreSQL"
        />
        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="form-field">
        <label className="form-label">Description</label>
        <textarea
          className="form-textarea form-textarea--sm"
          value={alt.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Brief description of this option..."
          rows={2}
        />
      </div>

      <div className="alt-card__pros-cons">
        <div className="form-field">
          <label className="form-label form-label--pros">Pros</label>
          <InlineListInput
            values={alt.pros}
            onChange={(v) => set('pros', v)}
            placeholder="Add a pro, press Enter"
          />
        </div>
        <div className="form-field">
          <label className="form-label form-label--cons">Cons</label>
          <InlineListInput
            values={alt.cons}
            onChange={(v) => set('cons', v)}
            placeholder="Add a con, press Enter"
          />
        </div>
      </div>
    </div>
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="step-indicator" role="progressbar" aria-valuenow={current + 1} aria-valuemax={total}>
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="step-indicator__item">
          <div className={`step-indicator__dot ${i < current ? 'step-indicator__dot--done' : i === current ? 'step-indicator__dot--active' : ''}`}>
            {i < current ? <Check size={12} strokeWidth={3} /> : <span>{i + 1}</span>}
          </div>
          <span className={`step-indicator__label ${i === current ? 'step-indicator__label--active' : ''}`}>
            {label}
          </span>
          {i < total - 1 && (
            <div className={`step-indicator__connector ${i < current ? 'step-indicator__connector--done' : ''}`} />
          )}
        </div>
      ))}
    </div>
  )
}

const INITIAL_STATE: FormState = {
  title: '',
  context: '',
  tags: [],
  alternatives: [makeAlt()],
  rationale: '',
  stakeholders: [],
  reviewDate: '',
}

export function NewDecision() {
  const navigate = useNavigate()
  const { workspaceId, decisionId } = useParams<{
    workspaceId?: string
    decisionId?: string
  }>()

  const isEditMode = !!(workspaceId && decisionId)
  const workspace  = useWorkspaceStore((s) => s.activeWorkspace)

  const [step, setStep]                     = useState(0)
  const [form, setForm]                     = useState<FormState>(INITIAL_STATE)
  const [errors, setErrors]                 = useState<StepErrors>({})
  const [submitting, setSubmitting]         = useState(false)
  const [loadingDecision, setLoadingDecision] = useState(isEditMode)

  useEffect(() => {
    if (!isEditMode) return
    setLoadingDecision(true)
    getDecision(workspaceId!, decisionId!)
      .then((d) => {
        setForm({
          title:        d.title,
          context:      d.context ?? '',
          tags:         d.tags ?? [],
          rationale:    d.rationale ?? '',
          stakeholders: d.stakeholders ?? [],
          reviewDate:   d.review_date ? d.review_date.split('T')[0] : '',
          alternatives: (d.alternatives ?? []).map((a) => ({
            id:          a.id ?? uid(),
            title:       a.title,
            description: a.description ?? '',
            pros:        a.pros ?? [],
            cons:        a.cons ?? [],
            isSelected:  a.is_selected ?? false,
          })),
        })
      })
      .catch(() => {
        toast.error('Could not load decision')
        navigate(-1)
      })
      .finally(() => setLoadingDecision(false))
  }, [isEditMode, workspaceId, decisionId]) // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  function updateAlt(index: number, updated: AlternativeForm) {
    const next = [...form.alternatives]
    next[index] = updated
    setForm((f) => ({ ...f, alternatives: next }))
    setErrors((e) => ({ ...e, [`alt_${index}`]: '' }))
  }

  function addAlt() {
    setForm((f) => ({ ...f, alternatives: [...f.alternatives, makeAlt()] }))
  }

  function removeAlt(index: number) {
    if (form.alternatives.length <= 1) return
    setForm((f) => ({ ...f, alternatives: f.alternatives.filter((_, i) => i !== index) }))
  }

  function selectAlt(index: number) {
    setForm((f) => ({
      ...f,
      alternatives: f.alternatives.map((a, i) => ({ ...a, isSelected: i === index })),
    }))
  }

  function validateStep0(): boolean {
    const errs: StepErrors = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep1(): boolean {
    const errs: StepErrors = {}
    if (form.alternatives.length === 0) errs.alternatives = 'Add at least one alternative'
    form.alternatives.forEach((a, i) => {
      if (!a.title.trim()) errs[`alt_${i}`] = 'Alternative title is required'
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep2(): boolean {
    const errs: StepErrors = {}
    if (!form.rationale.trim()) errs.rationale = 'Rationale is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function next() {
    const valid = step === 0 ? validateStep0() : step === 1 ? validateStep1() : true
    if (valid) setStep((s) => s + 1)
  }

  function back() {
    setErrors({})
    setStep((s) => s - 1)
  }

  async function handleSubmit() {
    if (!validateStep2()) return
    const wsId = workspaceId ?? workspace?.id
    if (!wsId) { toast.error('No active workspace'); return }

    const payload = {
      title:        form.title.trim(),
      context:      form.context.trim(),
      rationale:    form.rationale.trim(),
      tags:         form.tags,
      stakeholders: form.stakeholders,
      review_date:  form.reviewDate || null,
      alternatives: form.alternatives.map((a) => ({
        title:       a.title.trim(),
        description: a.description.trim(),
        pros:        a.pros,
        cons:        a.cons,
        is_selected: a.isSelected,
      })),
    }

    setSubmitting(true)
    try {
      if (isEditMode) {
        await updateDecision(wsId, decisionId!, payload)
        toast.success('Decision updated!')
        navigate(`/workspaces/${wsId}/decisions/${decisionId}`)
      } else {
        const created = await createDecision(wsId, payload)
        toast.success('Decision logged successfully!')
        navigate(`/workspaces/${wsId}/decisions/${created.id}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : isEditMode ? 'Failed to update decision' : 'Failed to create decision'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingDecision) {
    return (
      <div className="new-decision">
        <div className="new-decision__header">
          <h1 className="new-decision__title">Edit Decision</h1>
        </div>
        <div className="new-decision__card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="btn-spinner" style={{ display: 'inline-block' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading decision...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="new-decision">
      <div className="new-decision__header">
        <h1 className="new-decision__title">{isEditMode ? 'Edit Decision' : 'Log a Decision'}</h1>
        <p className="new-decision__subtitle">
          {isEditMode
            ? 'Update the details, alternatives, and rationale for this decision.'
            : 'Capture context, alternatives, and the rationale behind your choice.'}
        </p>
      </div>

      <StepIndicator current={step} total={3} />

      <div className="new-decision__card">

        {step === 0 && (
          <div className="step-content" key="step0">
            <h2 className="step-content__heading">The Decision</h2>
            <p className="step-content__sub">What decision was made and why was it needed?</p>

            <div className="form-field">
              <label htmlFor="nd-title" className="form-label">
                Title <span className="form-required">*</span>
              </label>
              <input
                id="nd-title"
                className={`form-input ${errors.title ? 'form-input--error' : ''}`}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Choose primary database for user service"
                autoFocus
              />
              {errors.title && <p className="form-error">{errors.title}</p>}
            </div>

            <div className="form-field">
              <label htmlFor="nd-context" className="form-label">
                Context
                <span className="form-label__hint"> — Why was this decision needed?</span>
              </label>
              <textarea
                id="nd-context"
                className="form-textarea"
                value={form.context}
                onChange={(e) => set('context', e.target.value)}
                placeholder="Describe the situation that required a decision..."
                rows={4}
              />
            </div>

            <div className="form-field">
              <label htmlFor="nd-tags" className="form-label">
                Tags
                <span className="form-label__hint"> — Press Enter to add</span>
              </label>
              <TagInput
                id="nd-tags"
                values={form.tags}
                onChange={(v) => set('tags', v)}
                placeholder="e.g. infrastructure, backend..."
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="step-content" key="step1">
            <h2 className="step-content__heading">Alternatives</h2>
            <p className="step-content__sub">
              List the options you considered and mark the one that was chosen.
            </p>

            {errors.alternatives && (
              <p className="form-error form-error--block">{errors.alternatives}</p>
            )}

            <div className="alt-list">
              {form.alternatives.map((alt, i) => (
                <AlternativeCard
                  key={alt.id}
                  alt={alt}
                  index={i}
                  isSelected={alt.isSelected}
                  onSelect={() => selectAlt(i)}
                  onChange={(updated) => updateAlt(i, updated)}
                  onRemove={() => removeAlt(i)}
                  error={errors[`alt_${i}`]}
                />
              ))}
            </div>

            <button type="button" className="btn-add-alt" onClick={addAlt} id="btn-add-alternative">
              <Plus size={16} strokeWidth={2.5} />
              Add Alternative
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="step-content" key="step2">
            <h2 className="step-content__heading">Rationale & Stakeholders</h2>
            <p className="step-content__sub">
              Record why the chosen alternative was selected and who was involved.
            </p>

            {(() => {
              const chosen = form.alternatives.find((a) => a.isSelected)
              return chosen ? (
                <div className="chosen-alt-preview">
                  <span className="chosen-alt-preview__label">Chosen alternative</span>
                  <span className="chosen-alt-preview__value">{chosen.title}</span>
                </div>
              ) : (
                <div className="chosen-alt-preview chosen-alt-preview--none">
                  No alternative marked as chosen — go back and select one.
                </div>
              )
            })()}

            <div className="form-field">
              <label htmlFor="nd-rationale" className="form-label">
                Rationale <span className="form-required">*</span>
                <span className="form-label__hint"> — Why was this alternative chosen?</span>
              </label>
              <textarea
                id="nd-rationale"
                className={`form-textarea ${errors.rationale ? 'form-textarea--error' : ''}`}
                value={form.rationale}
                onChange={(e) => set('rationale', e.target.value)}
                placeholder="Explain the reasoning behind this decision..."
                rows={5}
                autoFocus
              />
              {errors.rationale && <p className="form-error">{errors.rationale}</p>}
            </div>

            <div className="form-field">
              <label htmlFor="nd-stakeholders" className="form-label">
                Stakeholders
                <span className="form-label__hint"> — Press Enter to add</span>
              </label>
              <TagInput
                id="nd-stakeholders"
                values={form.stakeholders}
                onChange={(v) => set('stakeholders', v)}
                placeholder="e.g. Engineering, Product..."
              />
            </div>

            <div className="form-field">
              <label htmlFor="nd-review-date" className="form-label">
                Review Date
                <span className="form-label__hint"> — When should this decision be re-evaluated?</span>
              </label>
              <input
                id="nd-review-date"
                type="date"
                className={`form-input form-input--date ${errors.reviewDate ? 'form-input--error' : ''}`}
                value={form.reviewDate}
                onChange={(e) => set('reviewDate', e.target.value)}
              />
              {errors.reviewDate && <p className="form-error">{errors.reviewDate}</p>}
            </div>
          </div>
        )}

        <div className="step-nav">
          {step > 0 ? (
            <button type="button" className="btn-back" onClick={back}>
              <ChevronLeft size={16} />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 2 ? (
            <button type="button" className="btn-next" onClick={next} id={`btn-step${step}-next`}>
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn-submit"
              onClick={handleSubmit}
              disabled={submitting}
              id="btn-submit-decision"
            >
              {submitting ? (
                <span className="btn-loading">
                  <span className="btn-spinner" />
                  {isEditMode ? 'Saving...' : 'Logging...'}
                </span>
              ) : (
                isEditMode ? 'Save Changes' : 'Log Decision'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

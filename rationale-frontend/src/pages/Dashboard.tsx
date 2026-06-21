import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal, FileX, Plus } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { DecisionCard } from '../components/decisions/DecisionCard'
import { useDecisions } from '../hooks/useDecisions'
import { useWorkspaceStore } from '../store/workspaceStore'

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="decision-card decision-card--skeleton" aria-hidden="true">
      <div className="skeleton skeleton--badge" />
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--line skeleton--line-short" />
      <div className="skeleton skeleton--tags">
        <div className="skeleton skeleton--tag" />
        <div className="skeleton skeleton--tag" />
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="dashboard__empty">
      <div className="dashboard__empty-icon">
        <FileX size={40} strokeWidth={1.25} />
      </div>
      <h2 className="dashboard__empty-title">No decisions yet</h2>
      <p className="dashboard__empty-body">
        Log your first decision to start building your organisation's decision history.
      </p>
      <button className="topbar__new-btn" onClick={onNew} id="empty-new-decision">
        <Plus size={16} strokeWidth={2.5} />
        <span>Log your first decision</span>
      </button>
    </div>
  )
}

// ── Status options ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '',           label: 'All statuses' },
  { value: 'draft',      label: 'Draft' },
  { value: 'active',     label: 'Active' },
  { value: 'reviewed',   label: 'Reviewed' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'archived',   label: 'Archived' },
]

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate     = useNavigate()
  const workspace    = useWorkspaceStore((s) => s.activeWorkspace)

  // Local UI state for filters
  const [searchInput, setSearchInput]   = useState('')
  const [keyword, setKeyword]           = useState('')      // debounced
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter]       = useState('')

  // Debounce search input → 300ms
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filters = useMemo(
    () => ({
      keyword:  keyword || undefined,
      status:   statusFilter || undefined,
      tag:      tagFilter   || undefined,
    }),
    [keyword, statusFilter, tagFilter],
  )

  const { decisions, loading, error } = useDecisions(filters)

  // Derive unique tags from loaded decisions for the tag filter dropdown
  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    decisions.forEach((d) => d.tags.forEach((t) => tags.add(t)))
    return Array.from(tags).sort()
  }, [decisions])

  const hasFilters = !!(keyword || statusFilter || tagFilter)

  return (
    <div className="dashboard">
      <TopBar title="Decisions" />

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="dashboard__toolbar">
        {/* Search */}
        <div className="search-box">
          <Search size={16} className="search-box__icon" strokeWidth={2} />
          <input
            id="decision-search"
            type="search"
            className="search-box__input"
            placeholder="Search decisions…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search decisions"
          />
        </div>

        {/* Filters */}
        <div className="dashboard__filters">
          <div className="filter-select-wrap">
            <SlidersHorizontal size={14} className="filter-select-icon" />
            <select
              id="filter-status"
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {availableTags.length > 0 && (
            <div className="filter-select-wrap">
              <select
                id="filter-tag"
                className="filter-select"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                aria-label="Filter by tag"
              >
                <option value="">All tags</option>
                {availableTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {hasFilters && (
            <button
              className="filter-clear"
              onClick={() => {
                setSearchInput('')
                setKeyword('')
                setStatusFilter('')
                setTagFilter('')
              }}
              id="filter-clear"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Error state ─────────────────────────────────────── */}
      {error && (
        <div className="dashboard__error" role="alert">
          {error}
        </div>
      )}

      {/* ── Loading skeletons ────────────────────────────────── */}
      {loading && (
        <div className="decision-grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {!loading && !error && decisions.length === 0 && (
        hasFilters ? (
          <div className="dashboard__empty">
            <div className="dashboard__empty-icon">
              <Search size={36} strokeWidth={1.25} />
            </div>
            <h2 className="dashboard__empty-title">No results found</h2>
            <p className="dashboard__empty-body">
              Try adjusting your search or filters.
            </p>
          </div>
        ) : (
          <EmptyState onNew={() => navigate('/decisions/new')} />
        )
      )}

      {/* ── Decision grid ─────────────────────────────────────── */}
      {!loading && decisions.length > 0 && (
        <div className="decision-grid">
          {decisions.map((d) => (
            <DecisionCard
              key={d.id}
              decision={d}
              workspaceId={workspace?.id ?? d.workspace_id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

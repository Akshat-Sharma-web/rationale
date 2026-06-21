/**
 * Analytics Dashboard page.
 *
 * Uses react-plotly.js (lazy-loaded via dynamic import wrapper) so the heavy
 * Plotly bundle does not block initial app load.
 *
 * Layout:
 *   Row 1 → 4 KPI stat cards
 *   Row 2 → Decisions Over Time (60%) + Decisions by Status donut (40%)
 *   Row 3 → Top Tags bar (50%) + Quality Score Trend line (50%)
 */
import { useState, useEffect, Suspense } from 'react'
import {
  BarChart3, CheckCircle2, Star, TrendingUp, AlertCircle,
} from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { getAnalytics } from '../api/analytics'
import { useWorkspaceStore } from '../store/workspaceStore'
import type { AnalyticsSummary } from '../types'

// ── Lazy Plotly (large bundle — split chunk) ──────────────────────────────────
// react-plotly.js exports a default component that needs Plotly as peer dep.
// We use plotly.js-dist-min (smaller build) via the factory pattern.
import createPlotlyComponent from 'react-plotly.js/factory'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import Plotly from 'plotly.js-dist-min'
const Plot = createPlotlyComponent(Plotly as unknown as Parameters<typeof createPlotlyComponent>[0])

// ── Shared chart theme ────────────────────────────────────────────────────────

const CHART_BG      = '#12121e'
const PAPER_BG      = '#12121e'
const GRID_COLOR    = 'rgba(255,255,255,0.06)'
const FONT_COLOR    = '#9ca3af'
const INDIGO        = '#4f46e5'
const INDIGO_LIGHT  = '#818cf8'

const baseLayout: Partial<Plotly.Layout> = {
  paper_bgcolor: PAPER_BG,
  plot_bgcolor:  CHART_BG,
  font:  { family: 'Inter, system-ui, sans-serif', color: FONT_COLOR, size: 12 },
  margin: { t: 36, r: 16, b: 48, l: 48 },
  xaxis: {
    gridcolor: GRID_COLOR,
    zerolinecolor: GRID_COLOR,
    tickfont: { color: FONT_COLOR },
  },
  yaxis: {
    gridcolor: GRID_COLOR,
    zerolinecolor: GRID_COLOR,
    tickfont: { color: FONT_COLOR },
  },
  showlegend: false,
}

const baseConfig: Partial<Plotly.Config> = {
  displayModeBar: false,
  responsive:     true,
}

// Status colour palette
const STATUS_COLORS: Record<string, string> = {
  active:     '#4f46e5',
  draft:      '#6b7280',
  reviewed:   '#10b981',
  superseded: '#f59e0b',
  archived:   '#374151',
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      className="skeleton analytics-chart-skeleton"
      style={{ height, borderRadius: 14 }}
      aria-hidden="true"
    />
  )
}

function KpiSkeleton() {
  return (
    <div className="kpi-card kpi-card--skeleton" aria-hidden="true">
      <div className="skeleton" style={{ height: 14, width: 80 }} />
      <div className="skeleton" style={{ height: 32, width: 60, marginTop: 10 }} />
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  accent?: string
}

function KpiCard({ label, value, sub, icon, accent = INDIGO }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="kpi-card__icon" style={{ background: `${accent}22`, color: accent }}>
        {icon}
      </div>
      <div>
        <p className="kpi-card__label">{label}</p>
        <p className="kpi-card__value">
          {value}
          {sub && <span className="kpi-card__sub">{sub}</span>}
        </p>
      </div>
    </div>
  )
}

// ── Chart wrapper ─────────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="analytics-chart-card">
      <h3 className="analytics-chart-card__title">{title}</h3>
      <div className="analytics-chart-card__body">{children}</div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="dashboard__empty" style={{ paddingTop: '5rem' }}>
      <div className="dashboard__empty-icon">
        <BarChart3 size={38} strokeWidth={1.25} />
      </div>
      <h2 className="dashboard__empty-title">No data yet to analyze</h2>
      <p className="dashboard__empty-body">
        Log your first decisions and submit outcome reviews to unlock analytics.
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Analytics() {
  const workspace = useWorkspaceStore((s) => s.activeWorkspace)
  const [data, setData]       = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!workspace) return
    setLoading(true)
    setError(null)
    getAnalytics(workspace.id)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [workspace?.id])

  // ── Derived chart data ──────────────────────────────────────────────────────

  const decisionsOverTime = data ? (() => {
    const months = data.decisions_over_time
    return {
      x: months.map((p) => p.date),
      y: months.map((p) => p.count),
    }
  })() : null

  const byStatus = data ? (() => {
    // Cast to unknown first to satisfy TS — decisions_by_status keys are known strings
    const s = data.decisions_by_status as unknown as Record<string, number>
    const labels = Object.keys(s).filter((k) => s[k] > 0)
    return {
      labels,
      values: labels.map((k) => s[k]),
      colors: labels.map((k) => STATUS_COLORS[k] ?? '#6b7280'),
    }
  })() : null

  const topTags = data ? (() => {
    const entries = Object.entries(data.decisions_by_tag)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    return {
      tags:   entries.map(([k]) => k),
      counts: entries.map(([, v]) => v),
    }
  })() : null

  const qualityTrend = data ? (() => {
    const points = data.quality_trend.filter((p) => p.avg_score !== null)
    return {
      x: points.map((p) => p.date),
      y: points.map((p) => p.avg_score as number),
    }
  })() : null

  // ── Chart heights ───────────────────────────────────────────────────────────
  const CHART_H = 280

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="analytics-page">
      <TopBar title="Analytics" />

      {/* Error banner */}
      {error && (
        <div className="dashboard__error" role="alert">
          <AlertCircle size={16} style={{ display: 'inline', marginRight: 6 }} />
          {error}
        </div>
      )}

      {/* No workspace */}
      {!workspace && !loading && (
        <div className="dashboard__empty">
          <p className="dashboard__empty-body">Select a workspace to see analytics.</p>
        </div>
      )}

      {/* Loading KPI skeleton */}
      {loading && (
        <>
          <div className="kpi-row">
            {[1,2,3,4].map((i) => <KpiSkeleton key={i} />)}
          </div>
          <div className="analytics-row analytics-row--6040">
            <ChartSkeleton height={CHART_H} />
            <ChartSkeleton height={CHART_H} />
          </div>
          <div className="analytics-row analytics-row--5050">
            <ChartSkeleton height={CHART_H} />
            <ChartSkeleton height={CHART_H} />
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && data?.total_decisions === 0 && <EmptyState />}

      {/* Dashboard content */}
      {!loading && data && data.total_decisions > 0 && (
        <>
          {/* ── Row 1: KPI cards ───────────────────────────────── */}
          <div className="kpi-row">
            <KpiCard
              label="Total Decisions"
              value={data.total_decisions}
              icon={<BarChart3 size={20} strokeWidth={1.75} />}
              accent={INDIGO}
            />
            <KpiCard
              label="Reviewed Decisions"
              value={data.reviewed_decisions}
              icon={<CheckCircle2 size={20} strokeWidth={1.75} />}
              accent="#10b981"
            />
            <KpiCard
              label="Avg Quality Score"
              value={
                data.avg_quality_score != null
                  ? data.avg_quality_score.toFixed(1)
                  : '—'
              }
              sub=" / 5"
              icon={<Star size={20} strokeWidth={1.75} />}
              accent="#f59e0b"
            />
            <KpiCard
              label="Review Completion"
              value={`${data.review_completion_rate.toFixed(0)}%`}
              icon={<TrendingUp size={20} strokeWidth={1.75} />}
              accent="#06b6d4"
            />
          </div>

          {/* ── Row 2: Line + Donut ────────────────────────────── */}
          <div className="analytics-row analytics-row--6040">

            {/* Decisions Over Time — line chart */}
            <ChartCard title="Decisions Over Time">
              <Suspense fallback={<ChartSkeleton height={CHART_H} />}>
                <Plot
                  data={[{
                    type:  'scatter',
                    mode:  'lines+markers',
                    x:     decisionsOverTime?.x ?? [],
                    y:     decisionsOverTime?.y ?? [],
                    line:  { color: INDIGO, width: 2.5, shape: 'spline' },
                    marker: { color: INDIGO_LIGHT, size: 6 },
                    fill:  'tozeroy',
                    fillcolor: 'rgba(79,70,229,0.1)',
                    hovertemplate: '<b>%{x}</b><br>%{y} decisions<extra></extra>',
                  }]}
                  layout={{
                    ...baseLayout,
                    height: CHART_H,
                    xaxis: { ...baseLayout.xaxis, title: '' },
                    yaxis: { ...baseLayout.yaxis, title: '' },
                  }}
                  config={baseConfig}
                  style={{ width: '100%', height: CHART_H }}
                />
              </Suspense>
            </ChartCard>

            {/* Decisions by Status — donut */}
            <ChartCard title="Decisions by Status">
              <Suspense fallback={<ChartSkeleton height={CHART_H} />}>
                <Plot
                  data={[{
                    type:   'pie',
                    hole:   0.55,
                    labels: byStatus?.labels ?? [],
                    values: byStatus?.values ?? [],
                    marker: { colors: byStatus?.colors ?? [] },
                    textfont: { color: FONT_COLOR, size: 11 },
                    hovertemplate: '<b>%{label}</b><br>%{value} decisions (%{percent})<extra></extra>',
                    textposition: 'inside',
                    insidetextorientation: 'radial',
                  }]}
                  layout={{
                    ...baseLayout,
                    height: CHART_H,
                    margin: { t: 24, r: 8, b: 8, l: 8 },
                    showlegend: true,
                    legend: {
                      orientation: 'v',
                      font: { color: FONT_COLOR, size: 11 },
                      x: 1.02, y: 0.5,
                    },
                  }}
                  config={baseConfig}
                  style={{ width: '100%', height: CHART_H }}
                />
              </Suspense>
            </ChartCard>
          </div>

          {/* ── Row 3: Tags + Quality Trend ────────────────────── */}
          <div className="analytics-row analytics-row--5050">

            {/* Top Tags — horizontal bar */}
            <ChartCard title="Top Tags">
              {topTags && topTags.tags.length > 0 ? (
                <Suspense fallback={<ChartSkeleton height={CHART_H} />}>
                  <Plot
                    data={[{
                      type:        'bar',
                      orientation: 'h',
                      x:    topTags.counts,
                      y:    topTags.tags,
                      marker: {
                        color: topTags.counts.map(
                          (_, i) => `hsl(${240 - i * 12}, 70%, ${60 + i * 2}%)`,
                        ),
                        line: { width: 0 },
                      },
                      hovertemplate: '<b>%{y}</b>: %{x} decisions<extra></extra>',
                    }]}
                    layout={{
                      ...baseLayout,
                      height: CHART_H,
                      yaxis: {
                        ...baseLayout.yaxis,
                        autorange:   'reversed',
                        tickfont:    { color: FONT_COLOR, size: 11 },
                        automargin:  true,
                      },
                      xaxis: { ...baseLayout.xaxis, title: 'Decisions' },
                      margin: { t: 16, r: 16, b: 40, l: 8 },
                    }}
                    config={baseConfig}
                    style={{ width: '100%', height: CHART_H }}
                  />
                </Suspense>
              ) : (
                <div style={{ color: FONT_COLOR, textAlign: 'center', paddingTop: 60, fontSize: '0.875rem' }}>
                  No tags recorded yet
                </div>
              )}
            </ChartCard>

            {/* Quality Score Trend — line with markers */}
            <ChartCard title="Quality Score Trend">
              {qualityTrend && qualityTrend.x.length > 0 ? (
                <Suspense fallback={<ChartSkeleton height={CHART_H} />}>
                  <Plot
                    data={[{
                      type:  'scatter',
                      mode:  'lines+markers',
                      x:     qualityTrend.x,
                      y:     qualityTrend.y,
                      line:  { color: '#f59e0b', width: 2.5, shape: 'spline' },
                      marker: { color: '#fcd34d', size: 7 },
                      fill:  'tozeroy',
                      fillcolor: 'rgba(245,158,11,0.08)',
                      hovertemplate: '<b>%{x}</b><br>Avg score: %{y:.1f}<extra></extra>',
                    }]}
                    layout={{
                      ...baseLayout,
                      height: CHART_H,
                      yaxis: {
                        ...baseLayout.yaxis,
                        range: [0, 5.5],
                        tickvals: [1, 2, 3, 4, 5],
                        title: 'Avg score',
                      },
                      xaxis: { ...baseLayout.xaxis, title: '' },
                    }}
                    config={baseConfig}
                    style={{ width: '100%', height: CHART_H }}
                  />
                </Suspense>
              ) : (
                <div style={{ color: FONT_COLOR, textAlign: 'center', paddingTop: 60, fontSize: '0.875rem' }}>
                  No reviews submitted yet
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}

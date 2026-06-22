// @ts-nocheck
import { useState, useEffect } from 'react'
import { BarChart3, CheckCircle2, Star, TrendingUp, AlertCircle } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { TopBar } from '../components/layout/TopBar'
import { getAnalytics } from '../api/analytics'
import { useWorkspaceStore } from '../store/workspaceStore'
import type { AnalyticsSummary } from '../types'

const INDIGO = '#4f46e5'
const FONT_COLOR = '#9ca3af'
const GRID_COLOR = 'rgba(255,255,255,0.06)'
const STATUS_COLORS: Record<string, string> = {
  active: '#4f46e5', draft: '#6b7280', reviewed: '#10b981',
  superseded: '#f59e0b', archived: '#374151',
}
const tooltipStyle = {
  backgroundColor: '#1a1a2e', border: '1px solid #2d2d4e',
  borderRadius: 8, color: '#f9fafb', fontSize: 12,
}

function KpiCard({ label, value, sub, icon, accent = INDIGO }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card__icon" style={{ background: `${accent}22`, color: accent }}>{icon}</div>
      <div>
        <p className="kpi-card__label">{label}</p>
        <p className="kpi-card__value">{value}{sub && <span className="kpi-card__sub">{sub}</span>}</p>
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="analytics-chart-card">
      <h3 className="analytics-chart-card__title">{title}</h3>
      <div className="analytics-chart-card__body">{children}</div>
    </div>
  )
}

export function Analytics() {
  const workspace = useWorkspaceStore((s) => s.activeWorkspace)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!workspace) return
    setLoading(true)
    setError(null)
    getAnalytics(workspace.id)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [workspace?.id])

  if (!workspace) {
    return (
      <div className="analytics-page">
        <TopBar title="Analytics" />
        <div className="dashboard__empty">
          <p className="dashboard__empty-body">Select a workspace to see analytics.</p>
        </div>
      </div>
    )
  }

  const CHART_H = 260
  const timelineData = data?.decisions_over_time?.map((p) => ({ date: p.date, count: p.count })) ?? []
  const statusData = data ? Object.entries(data.decisions_by_status).filter(([,v]) => v > 0).map(([k,v]) => ({ name: k, value: v, color: STATUS_COLORS[k] ?? '#6b7280' })) : []
  const tagData = data ? Object.entries(data.decisions_by_tag).sort((a,b) => b[1]-a[1]).slice(0,8).map(([tag,count]) => ({ tag, count })) : []
  const qualityData = data?.quality_trend?.filter((p) => p.avg_score !== null).map((p) => ({ date: p.date, score: p.avg_score })) ?? []

  return (
    <div className="analytics-page">
      <TopBar title="Analytics" />
      {error && <div className="dashboard__error" role="alert"><AlertCircle size={16} style={{ display: 'inline', marginRight: 6 }} />{error}</div>}
      {loading && <div style={{ padding: '2rem', color: FONT_COLOR }}>Loading analytics...</div>}
      {!loading && data?.total_decisions === 0 && (
        <div className="dashboard__empty" style={{ paddingTop: '5rem' }}>
          <div className="dashboard__empty-icon"><BarChart3 size={38} strokeWidth={1.25} /></div>
          <h2 className="dashboard__empty-title">No data yet to analyze</h2>
          <p className="dashboard__empty-body">Log your first decisions and submit outcome reviews to unlock analytics.</p>
        </div>
      )}
      {!loading && data && data.total_decisions > 0 && (
        <>
          <div className="kpi-row">
            <KpiCard label="Total Decisions" value={data.total_decisions} icon={<BarChart3 size={20} strokeWidth={1.75} />} accent={INDIGO} />
            <KpiCard label="Reviewed Decisions" value={data.reviewed_decisions} icon={<CheckCircle2 size={20} strokeWidth={1.75} />} accent="#10b981" />
            <KpiCard label="Avg Quality Score" value={data.avg_quality_score != null ? data.avg_quality_score.toFixed(1) : '—'} sub=" / 5" icon={<Star size={20} strokeWidth={1.75} />} accent="#f59e0b" />
            <KpiCard label="Review Completion" value={`${data.review_completion_rate.toFixed(0)}%`} icon={<TrendingUp size={20} strokeWidth={1.75} />} accent="#06b6d4" />
          </div>
          <div className="analytics-row analytics-row--6040">
            <ChartCard title="Decisions Over Time">
              <ResponsiveContainer width="100%" height={CHART_H}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="date" tick={{ fill: FONT_COLOR, fontSize: 11 }} />
                  <YAxis tick={{ fill: FONT_COLOR, fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="count" stroke={INDIGO} strokeWidth={2.5} dot={{ fill: '#818cf8', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Decisions by Status">
              <ResponsiveContainer width="100%" height={CHART_H}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" nameKey="name">
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend formatter={(v) => <span style={{ color: FONT_COLOR, fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="analytics-row analytics-row--5050">
            <ChartCard title="Top Tags">
              {tagData.length > 0 ? (
                <ResponsiveContainer width="100%" height={CHART_H}>
                  <BarChart data={tagData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                    <XAxis type="number" tick={{ fill: FONT_COLOR, fontSize: 11 }} />
                    <YAxis type="category" dataKey="tag" tick={{ fill: FONT_COLOR, fontSize: 11 }} width={80} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill={INDIGO} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ color: FONT_COLOR, textAlign: 'center', paddingTop: 60, fontSize: '0.875rem' }}>No tags recorded yet</div>}
            </ChartCard>
            <ChartCard title="Quality Score Trend">
              {qualityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={CHART_H}>
                  <LineChart data={qualityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                    <XAxis dataKey="date" tick={{ fill: FONT_COLOR, fontSize: 11 }} />
                    <YAxis domain={[0, 5]} ticks={[1,2,3,4,5]} tick={{ fill: FONT_COLOR, fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#fcd34d', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div style={{ color: FONT_COLOR, textAlign: 'center', paddingTop: 60, fontSize: '0.875rem' }}>No reviews submitted yet</div>}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}

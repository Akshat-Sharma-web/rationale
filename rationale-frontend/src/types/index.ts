// ──────────────────────────────────────────────
//  Auth & Identity
// ──────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
}

// ──────────────────────────────────────────────
//  Workspaces
// ──────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

// ──────────────────────────────────────────────
//  Decisions
// ──────────────────────────────────────────────

export type DecisionStatus = 'draft' | 'active' | 'superseded' | 'archived' | 'reviewed';

export interface CreatedByUser {
  id: string;
  name: string;
  email: string;
}

export interface Decision {
  id: string;
  workspace_id: string;
  title: string;
  context: string;
  selected_alternative: string | null;
  rationale: string;
  status: DecisionStatus;
  tags: string[];
  stakeholders: string[];
  review_date: string | null;
  created_at: string;
  created_by: CreatedByUser;
  alternatives: Alternative[];
  outcome_reviews: OutcomeReview[];
}

// ──────────────────────────────────────────────
//  Alternatives
// ──────────────────────────────────────────────

export interface Alternative {
  id: string;
  decision_id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  is_selected: boolean;
}

// ──────────────────────────────────────────────
//  Outcome Reviews
// ──────────────────────────────────────────────

export interface OutcomeReview {
  id: string;
  decision_id: string;
  actual_outcome: string;
  quality_score: number; // 1–5
  lessons_learned: string | null;
  reviewed_at: string;
  reviewed_by: string;
}

// ──────────────────────────────────────────────
//  Analytics
// ──────────────────────────────────────────────

export interface DecisionsByStatus {
  draft: number;
  active: number;
  reviewed: number;
  superseded: number;
  archived: number;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface QualityTrendPoint {
  date: string;
  avg_score: number | null;
}

export interface AnalyticsSummary {
  total_decisions: number;
  reviewed_decisions: number;
  pending_review: number;
  avg_quality_score: number | null;
  review_completion_rate: number;
  decisions_by_status: DecisionsByStatus;
  decisions_by_tag: Record<string, number>;
  decisions_over_time: TimeSeriesPoint[];
  quality_trend: QualityTrendPoint[];
}

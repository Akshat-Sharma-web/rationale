-- ============================================================
--  Migration 004: Analytics RPC function
--  Run in Supabase SQL Editor → New query
--  This replaces multi-round-trip Python aggregation with a
--  single PostgreSQL function call for sub-100ms response times.
-- ============================================================

CREATE OR REPLACE FUNCTION get_workspace_analytics(p_workspace_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as the function owner (bypasses RLS)
AS $$
DECLARE
  v_now            TIMESTAMPTZ := NOW();
  v_twelve_ago     TIMESTAMPTZ := NOW() - INTERVAL '12 months';
  v_reviewed       BIGINT;
  v_pending        BIGINT;
  v_total          BIGINT;
  v_avg_score      NUMERIC;
  v_completion     NUMERIC;
  v_by_status      JSON;
  v_by_tag         JSON;
  v_over_time      JSON;
  v_quality_trend  JSON;
BEGIN

  -- ── Scalar counts ──────────────────────────────────────────────────────────

  SELECT COUNT(*)
    INTO v_total
    FROM public.decisions
   WHERE workspace_id = p_workspace_id;

  SELECT COUNT(*)
    INTO v_reviewed
    FROM public.decisions
   WHERE workspace_id = p_workspace_id
     AND status = 'reviewed';

  -- Pending = has a review_date in the past but not yet reviewed
  SELECT COUNT(*)
    INTO v_pending
    FROM public.decisions
   WHERE workspace_id = p_workspace_id
     AND review_date IS NOT NULL
     AND review_date <= v_now
     AND status != 'reviewed';

  SELECT ROUND(AVG(r.quality_score)::NUMERIC, 2)
    INTO v_avg_score
    FROM public.outcome_reviews r
    JOIN public.decisions d ON d.id = r.decision_id
   WHERE d.workspace_id = p_workspace_id;

  -- review_completion_rate = reviewed / (reviewed + pending) * 100
  -- Returns 0.0 when both are zero
  v_completion := CASE
    WHEN (v_reviewed + v_pending) = 0 THEN 0.0
    ELSE ROUND((v_reviewed::NUMERIC / (v_reviewed + v_pending)) * 100, 2)
  END;

  -- ── Decisions by status ────────────────────────────────────────────────────
  -- Ensures all statuses appear even with a count of 0

  SELECT json_build_object(
    'draft',      COALESCE(SUM(CASE WHEN status = 'draft'      THEN 1 ELSE 0 END), 0),
    'active',     COALESCE(SUM(CASE WHEN status = 'active'     THEN 1 ELSE 0 END), 0),
    'reviewed',   COALESCE(SUM(CASE WHEN status = 'reviewed'   THEN 1 ELSE 0 END), 0),
    'superseded', COALESCE(SUM(CASE WHEN status = 'superseded' THEN 1 ELSE 0 END), 0),
    'archived',   COALESCE(SUM(CASE WHEN status = 'archived'   THEN 1 ELSE 0 END), 0)
  )
    INTO v_by_status
    FROM public.decisions
   WHERE workspace_id = p_workspace_id;

  -- ── Top-10 tags (unnest the tags array, group, count) ─────────────────────

  SELECT COALESCE(
    (SELECT json_object_agg(tag, cnt)
       FROM (
         SELECT tag, COUNT(*) AS cnt
           FROM public.decisions, UNNEST(tags) AS tag
          WHERE workspace_id = p_workspace_id
            AND tags IS NOT NULL
          GROUP BY tag
          ORDER BY cnt DESC
          LIMIT 10
       ) tag_counts
    ),
    '{}'::JSON
  ) INTO v_by_tag;

  -- ── Decisions over time: monthly counts, last 12 months ───────────────────
  -- Produces an array ordered by month ascending; months with 0 decisions
  -- are omitted (sparse representation — frontend fills gaps).

  SELECT COALESCE(
    json_agg(
      json_build_object('date', month_str, 'count', cnt)
      ORDER BY month_str
    ),
    '[]'::JSON
  )
    INTO v_over_time
    FROM (
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month_str,
        COUNT(*)::INT                                         AS cnt
        FROM public.decisions
       WHERE workspace_id = p_workspace_id
         AND created_at >= v_twelve_ago
       GROUP BY month_str
    ) monthly_decisions;

  -- ── Quality trend: monthly avg quality score, last 12 months ──────────────
  -- Months with no reviews produce a null avg_score entry.

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'date',      month_str,
        'avg_score', avg_score
      )
      ORDER BY month_str
    ),
    '[]'::JSON
  )
    INTO v_quality_trend
    FROM (
      SELECT
        TO_CHAR(DATE_TRUNC('month', r.reviewed_at), 'YYYY-MM') AS month_str,
        ROUND(AVG(r.quality_score)::NUMERIC, 2)                 AS avg_score
        FROM public.outcome_reviews r
        JOIN public.decisions d ON d.id = r.decision_id
       WHERE d.workspace_id = p_workspace_id
         AND r.reviewed_at >= v_twelve_ago
       GROUP BY month_str
    ) monthly_quality;

  -- ── Assemble and return ────────────────────────────────────────────────────

  RETURN json_build_object(
    'total_decisions',        v_total,
    'reviewed_decisions',     v_reviewed,
    'pending_review',         v_pending,
    'avg_quality_score',      v_avg_score,       -- NULL when no reviews exist
    'review_completion_rate', v_completion,
    'decisions_by_status',    v_by_status,
    'decisions_by_tag',       v_by_tag,
    'decisions_over_time',    v_over_time,
    'quality_trend',          v_quality_trend
  );

END;
$$;

-- Grant execute to the service_role used by the FastAPI backend
GRANT EXECUTE ON FUNCTION get_workspace_analytics(UUID) TO service_role;

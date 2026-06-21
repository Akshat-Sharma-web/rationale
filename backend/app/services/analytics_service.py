"""
AnalyticsService — workspace analytics aggregation.

Primary strategy: single Supabase RPC call to the `get_workspace_analytics`
PostgreSQL function (migration 004). This does all aggregation server-side in
one round-trip, easily hitting the <500ms target for 100+ decision workspaces.

Fallback strategy: if the RPC function hasn't been deployed yet the service
falls back to Python-side aggregation using multiple PostgREST queries.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.analytics import (
    AnalyticsSummary,
    QualityTrendPoint,
    StatusBreakdown,
    TimeSeriesPoint,
)


# ── Auth helper ───────────────────────────────────────────────────────────────

def _assert_member(db: Client, *, workspace_id: str, user_id: str) -> None:
    resp = (
        db.table("workspace_members")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this workspace",
        )


# ── RPC path ──────────────────────────────────────────────────────────────────

def _from_rpc(raw: dict) -> AnalyticsSummary:
    """Parse the JSON object returned by get_workspace_analytics()."""
    by_status_raw: dict = raw.get("decisions_by_status") or {}
    decisions_by_status = StatusBreakdown(
        draft=by_status_raw.get("draft", 0),
        active=by_status_raw.get("active", 0),
        reviewed=by_status_raw.get("reviewed", 0),
        superseded=by_status_raw.get("superseded", 0),
        archived=by_status_raw.get("archived", 0),
    )

    over_time = [
        TimeSeriesPoint(date=p["date"], count=p["count"])
        for p in (raw.get("decisions_over_time") or [])
    ]

    quality_trend = [
        QualityTrendPoint(date=p["date"], avg_score=p.get("avg_score"))
        for p in (raw.get("quality_trend") or [])
    ]

    # Ensure avg_quality_score is float or None (Postgres may return Decimal)
    avg_raw = raw.get("avg_quality_score")
    avg_quality = float(avg_raw) if avg_raw is not None else None

    return AnalyticsSummary(
        total_decisions=int(raw.get("total_decisions", 0)),
        reviewed_decisions=int(raw.get("reviewed_decisions", 0)),
        pending_review=int(raw.get("pending_review", 0)),
        avg_quality_score=avg_quality,
        review_completion_rate=float(raw.get("review_completion_rate", 0.0)),
        decisions_by_status=decisions_by_status,
        decisions_by_tag=raw.get("decisions_by_tag") or {},
        decisions_over_time=over_time,
        quality_trend=quality_trend,
    )


# ── Python fallback ───────────────────────────────────────────────────────────

def _python_fallback(db: Client, workspace_id: str) -> AnalyticsSummary:
    """
    Compute analytics via multiple PostgREST queries.
    Used when the SQL function (migration 004) hasn't been deployed.
    Slightly slower but functionally equivalent.
    """
    now = datetime.now(timezone.utc)
    twelve_ago_iso = (now.replace(month=now.month - 12) if now.month > 12
                      else now.replace(year=now.year - 1)).isoformat()

    # Fetch decisions (all — needed for status/tag/time counts)
    d_resp = (
        db.table("decisions")
        .select("id, status, tags, created_at, review_date")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    decisions = d_resp.data or []
    decision_ids = [d["id"] for d in decisions]

    # Fetch reviews
    reviews: list[dict] = []
    if decision_ids:
        r_resp = (
            db.table("outcome_reviews")
            .select("decision_id, quality_score, reviewed_at")
            .in_("decision_id", decision_ids)
            .execute()
        )
        reviews = r_resp.data or []

    # Scalar counts
    total = len(decisions)
    reviewed_count = sum(1 for d in decisions if d.get("status") == "reviewed")
    pending_count = sum(
        1 for d in decisions
        if d.get("review_date")
        and d.get("status") != "reviewed"
        and datetime.fromisoformat(d["review_date"].replace("Z", "+00:00")) <= now
    )
    completion_rate = (
        round((reviewed_count / (reviewed_count + pending_count)) * 100, 2)
        if (reviewed_count + pending_count) > 0 else 0.0
    )

    # avg quality score
    scores = [float(r["quality_score"]) for r in reviews]
    avg_quality: float | None = round(sum(scores) / len(scores), 2) if scores else None

    # Decisions by status
    sc: Counter[str] = Counter(d.get("status", "draft") for d in decisions)
    decisions_by_status = StatusBreakdown(
        draft=sc.get("draft", 0),
        active=sc.get("active", 0),
        reviewed=sc.get("reviewed", 0),
        superseded=sc.get("superseded", 0),
        archived=sc.get("archived", 0),
    )

    # Top-10 tags
    tag_counter: Counter[str] = Counter()
    for d in decisions:
        for tag in (d.get("tags") or []):
            tag_counter[tag] += 1
    decisions_by_tag = dict(tag_counter.most_common(10))

    # Decisions over time (last 12 months, monthly)
    month_counter: Counter[str] = Counter()
    for d in decisions:
        try:
            dt = datetime.fromisoformat(d["created_at"].replace("Z", "+00:00"))
            if dt >= datetime.fromisoformat(twelve_ago_iso):
                month_counter[dt.strftime("%Y-%m")] += 1
        except (ValueError, AttributeError):
            pass
    decisions_over_time = [
        TimeSeriesPoint(date=m, count=c)
        for m, c in sorted(month_counter.items())
    ]

    # Quality trend (last 12 months, monthly)
    month_scores: dict[str, list[float]] = defaultdict(list)
    for r in reviews:
        try:
            dt = datetime.fromisoformat(r["reviewed_at"].replace("Z", "+00:00"))
            if dt >= datetime.fromisoformat(twelve_ago_iso):
                month_scores[dt.strftime("%Y-%m")].append(float(r["quality_score"]))
        except (ValueError, AttributeError):
            pass
    quality_trend = [
        QualityTrendPoint(date=m, avg_score=round(sum(s) / len(s), 2))
        for m, s in sorted(month_scores.items())
    ]

    return AnalyticsSummary(
        total_decisions=total,
        reviewed_decisions=reviewed_count,
        pending_review=pending_count,
        avg_quality_score=avg_quality,
        review_completion_rate=completion_rate,
        decisions_by_status=decisions_by_status,
        decisions_by_tag=decisions_by_tag,
        decisions_over_time=decisions_over_time,
        quality_trend=quality_trend,
    )


# ── Service ───────────────────────────────────────────────────────────────────

class AnalyticsService:

    @staticmethod
    def get_workspace_analytics(
        db: Client,
        *,
        workspace_id: str,
        user_id: str,
    ) -> AnalyticsSummary:
        """
        Return aggregated analytics for a workspace.

        Membership check is performed first (403 for non-members).
        Attempts a single RPC call to the `get_workspace_analytics` PostgreSQL
        function for efficiency. Falls back to Python-side aggregation if the
        function is not yet deployed (allows the service to work before
        migration 004 is applied).
        """
        _assert_member(db, workspace_id=workspace_id, user_id=user_id)

        # ── Try RPC first (fast path) ─────────────────────────────────────────
        try:
            rpc_resp = db.rpc(
                "get_workspace_analytics",
                {"p_workspace_id": workspace_id},
            ).execute()
            if rpc_resp.data:
                return _from_rpc(rpc_resp.data)
        except Exception:
            pass  # RPC not available yet — fall through to Python path

        # ── Python fallback (slower but always available) ─────────────────────
        return _python_fallback(db, workspace_id)

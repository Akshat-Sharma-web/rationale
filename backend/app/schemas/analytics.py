from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


# ── Sub-schemas ───────────────────────────────────────────────────────────────

class StatusBreakdown(BaseModel):
    """Decision counts per status. All fields default to 0."""
    draft: int = 0
    active: int = 0
    reviewed: int = 0
    superseded: int = 0
    archived: int = 0


class TimeSeriesPoint(BaseModel):
    """Monthly decision count. Sparse — months with 0 are omitted."""
    date: str    # "YYYY-MM"
    count: int


class QualityTrendPoint(BaseModel):
    """Monthly average quality score. avg_score is None when there are no reviews."""
    date: str               # "YYYY-MM"
    avg_score: Optional[float]  # null when no reviews recorded that month


# ── Top-level response ────────────────────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    total_decisions: int                     # all decisions in workspace
    reviewed_decisions: int                  # decisions with status='reviewed'
    pending_review: int                      # review_date <= today AND not reviewed
    avg_quality_score: Optional[float]       # null when no reviews exist
    review_completion_rate: float            # 0.0–100.0 (reviewed / (reviewed + pending))
    decisions_by_status: StatusBreakdown     # counts per status bucket
    decisions_by_tag: dict[str, int]         # top-10 tags → count
    decisions_over_time: list[TimeSeriesPoint]   # monthly counts, last 12 months
    quality_trend: list[QualityTrendPoint]       # monthly avg score, last 12 months

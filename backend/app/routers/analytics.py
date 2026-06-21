from fastapi import APIRouter, Depends

from app.auth import verify_token
from app.database import supabase
from app.schemas.analytics import AnalyticsSummary
from app.services.analytics_service import AnalyticsService

# Nested under /workspaces: GET /api/v1/workspaces/{workspace_id}/analytics
router = APIRouter(prefix="/workspaces", tags=["analytics"])


@router.get(
    "/{workspace_id}/analytics",
    response_model=AnalyticsSummary,
    summary="Workspace analytics",
    description=(
        "Return aggregated analytics for a workspace. "
        "Fields are always present — counts default to **0**, "
        "`avg_quality_score` is **null** when no reviews exist. "
        "Optimised via a single PostgreSQL RPC call for sub-500ms response times. "
        "**Members only** (403 for non-members)."
    ),
)
def get_analytics(
    workspace_id: str,
    user_id: str = Depends(verify_token),
) -> AnalyticsSummary:
    return AnalyticsService.get_workspace_analytics(
        supabase,
        workspace_id=workspace_id,
        user_id=user_id,
    )

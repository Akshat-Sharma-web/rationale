from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import verify_token
from app.database import supabase
from app.schemas.decision import (
    DecisionCreate,
    DecisionFilters,
    DecisionResponse,
    DecisionUpdate,
    OutcomeReviewCreate,
    OutcomeReviewResponse,
)
from app.services.decision_service import DecisionService

# Nested under /workspaces so final paths are:
# /api/v1/workspaces/{workspace_id}/decisions/...
router = APIRouter(prefix="/workspaces", tags=["decisions"])


@router.get(
    "/{workspace_id}/decisions",
    response_model=list[DecisionResponse],
    summary="List decisions",
    description=(
        "List all decisions in a workspace. "
        "Supports optional filters: `status`, `tag`, `creator_id`, and `keyword` "
        "(case-insensitive search across title and context)."
    ),
)
def list_decisions(
    workspace_id: str,
    status: Optional[str] = Query(None, description="Filter by status (draft|active|superseded|archived)"),
    tag: Optional[str] = Query(None, description="Filter decisions that contain this tag"),
    creator_id: Optional[str] = Query(None, description="Filter by creator user ID"),
    keyword: Optional[str] = Query(None, description="Search in title and context"),
    user_id: str = Depends(verify_token),
) -> list[DecisionResponse]:
    filters = DecisionFilters(status=status, tag=tag, creator_id=creator_id, keyword=keyword)
    return DecisionService.list_decisions(
        supabase, workspace_id=workspace_id, user_id=user_id, filters=filters
    )


@router.post(
    "/{workspace_id}/decisions",
    response_model=DecisionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a decision",
    description=(
        "Create a new decision with optional alternatives. "
        "If an alternative has `is_selected: true`, it will be linked as "
        "`selected_alternative` on the decision. "
        "**Viewers are rejected with 403.**"
    ),
)
def create_decision(
    workspace_id: str,
    payload: DecisionCreate,
    user_id: str = Depends(verify_token),
) -> DecisionResponse:
    return DecisionService.create_decision(
        supabase, user_id=user_id, workspace_id=workspace_id, data=payload
    )


@router.get(
    "/{workspace_id}/decisions/{decision_id}",
    response_model=DecisionResponse,
    summary="Get a decision",
    description="Fetch a single decision including its alternatives and outcome reviews.",
)
def get_decision(
    workspace_id: str,
    decision_id: str,
    user_id: str = Depends(verify_token),
) -> DecisionResponse:
    return DecisionService.get_decision(
        supabase, decision_id=decision_id, workspace_id=workspace_id, user_id=user_id
    )


@router.patch(
    "/{workspace_id}/decisions/{decision_id}",
    response_model=DecisionResponse,
    summary="Update a decision",
    description=(
        "Partially update a decision. All fields are optional. "
        "Members can only update decisions they created; admins can update any."
    ),
)
def update_decision(
    workspace_id: str,
    decision_id: str,
    payload: DecisionUpdate,
    user_id: str = Depends(verify_token),
) -> DecisionResponse:
    return DecisionService.update_decision(
        supabase,
        decision_id=decision_id,
        workspace_id=workspace_id,
        user_id=user_id,
        data=payload,
    )


@router.delete(
    "/{workspace_id}/decisions/{decision_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a decision",
    description="Permanently delete a decision and all related data. **Admin/owner only.**",
)
def delete_decision(
    workspace_id: str,
    decision_id: str,
    user_id: str = Depends(verify_token),
) -> None:
    DecisionService.delete_decision(
        supabase, decision_id=decision_id, workspace_id=workspace_id, user_id=user_id
    )


# ── DEPRECATED nested review route ───────────────────────────────────────────
# This route is intentionally broken — it raises 410 Gone.
# Use POST /api/v1/decisions/{decision_id}/review instead.
# Kept here so existing clients get a clear redirect message rather than a 404.
@router.post(
    "/{workspace_id}/decisions/{decision_id}/reviews",
    status_code=status.HTTP_410_GONE,
    summary="Submit outcome review (deprecated — do not use)",
    deprecated=True,
    include_in_schema=False,  # hidden from /docs
)
def add_review_deprecated(
    workspace_id: str,
    decision_id: str,
    user_id: str = Depends(verify_token),
) -> None:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "This endpoint is deprecated and no longer accepts submissions. "
            "Use POST /api/v1/decisions/{decision_id}/review instead — "
            "it enforces quality_score 1–5, past review_date, one review per decision, "
            "and updates decision status to 'reviewed'."
        ),
    )


# ── Flat review routes: /api/v1/decisions/{decision_id}/review ────────────────
# Registered separately in main.py as reviews_router.
reviews_router = APIRouter(prefix="/decisions", tags=["reviews"])


@reviews_router.post(
    "/{decision_id}/review",
    response_model=OutcomeReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit outcome review",
    description=(
        "Submit an outcome review for a decision. "
        "**Rules:** quality_score 1–5; review_date must be today or earlier (422 if future); "
        "only one review per decision (409 if already submitted); viewers are rejected (403)."
    ),
)
def submit_review(
    decision_id: str,
    payload: OutcomeReviewCreate,
    user_id: str = Depends(verify_token),
) -> OutcomeReviewResponse:
    return DecisionService.submit_review(
        supabase,
        decision_id=decision_id,
        user_id=user_id,
        data=payload,
    )


@reviews_router.get(
    "/{decision_id}/review",
    response_model=OutcomeReviewResponse,
    summary="Get outcome review",
    description="Fetch the outcome review for a decision. Returns 404 if no review has been submitted yet.",
)
def get_review(
    decision_id: str,
    user_id: str = Depends(verify_token),
) -> OutcomeReviewResponse:
    return DecisionService.get_review(
        supabase,
        decision_id=decision_id,
        user_id=user_id,
    )
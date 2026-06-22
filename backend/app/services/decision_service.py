"""
DecisionService â€” full Supabase implementation.
Uses the service_role client (bypasses RLS); access is enforced manually.

Role permission matrix:
  viewer  â†’ read only
  member  â†’ read + create + update own decisions
  admin   â†’ read + create + update any + delete
  owner   â†’ same as admin
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.decision import (
    AlternativeResponse,
    CreatedByUser,
    DecisionCreate,
    DecisionFilters,
    DecisionResponse,
    DecisionUpdate,
    OutcomeReviewCreate,
    OutcomeReviewResponse,
)


# â”€â”€ Role helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

_WRITE_ROLES = {"owner", "admin", "member"}
_ADMIN_ROLES = {"owner", "admin"}


def _get_role(db: Client, *, workspace_id: str, user_id: str) -> str:
    """
    Return the user's role in the workspace.
    Raises 403 if they are not a member at all.
    """
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
            detail="You are not a member of this workspace",
        )
    return resp.data[0]["role"]


def _require_write(db: Client, *, workspace_id: str, user_id: str) -> str:
    """Return role if allowed to write; 403 for viewers."""
    role = _get_role(db, workspace_id=workspace_id, user_id=user_id)
    if role not in _WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot create or modify decisions",
        )
    return role


def _require_admin(db: Client, *, workspace_id: str, user_id: str) -> str:
    """Return role if admin/owner; 403 otherwise."""
    role = _get_role(db, workspace_id=workspace_id, user_id=user_id)
    if role not in _ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can perform this action",
        )
    return role


# â”€â”€ User info cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _fetch_user(db: Client, user_id: str) -> CreatedByUser:
    """Fetch a user's name and email from Supabase Auth admin API."""
    try:
        resp = db.auth.admin.get_user_by_id(user_id)
        u = resp.user
        return CreatedByUser(
            id=u.id,
            name=u.user_metadata.get("name") or u.email or "",
            email=u.email or "",
        )
    except Exception:
        return CreatedByUser(id=user_id, name="Unknown", email="")


def _fetch_users_bulk(db: Client, user_ids: list[str]) -> dict[str, CreatedByUser]:
    """Batch-fetch user info; returns {user_id: CreatedByUser}."""
    unique_ids = list(set(user_ids))
    result: dict[str, CreatedByUser] = {}
    for uid in unique_ids:
        result[uid] = _fetch_user(db, uid)
    return result


# â”€â”€ Row mappers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _map_alternative(row: dict) -> AlternativeResponse:
    return AlternativeResponse(
        id=row["id"],
        decision_id=row["decision_id"],
        title=row["title"],
        description=row.get("description") or "",
        pros=row.get("pros") or [],
        cons=row.get("cons") or [],
        is_selected=row.get("is_selected", False),
    )


def _map_review(row: dict) -> OutcomeReviewResponse:
    return OutcomeReviewResponse(
        id=row["id"],
        decision_id=row["decision_id"],
        actual_outcome=row["actual_outcome"],
        quality_score=row["quality_score"],
        lessons_learned=row.get("lessons_learned"),  # Optional
        reviewed_at=row["reviewed_at"],
        reviewed_by=row.get("reviewed_by") or "",
    )


def _map_decision(
    row: dict,
    creator: CreatedByUser,
    alternatives: list[AlternativeResponse],
    reviews: list[OutcomeReviewResponse] | None = None,
) -> DecisionResponse:
    return DecisionResponse(
        id=row["id"],
        workspace_id=row["workspace_id"],
        title=row["title"],
        context=row.get("context") or "",
        selected_alternative=row.get("selected_alternative"),
        rationale=row.get("rationale") or "",
        status=row.get("status", "draft"),
        tags=row.get("tags") or [],
        stakeholders=row.get("stakeholders") or [],
        review_date=row.get("review_date"),
        created_at=row["created_at"],
        created_by=creator,
        alternatives=alternatives,
        outcome_reviews=reviews or [],
    )


# â”€â”€ Service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class DecisionService:

    @staticmethod
    def create_decision(
        db: Client,
        *,
        user_id: str,
        workspace_id: str,
        data: DecisionCreate,
    ) -> DecisionResponse:
        """
        Insert a decision then its alternatives atomically (best-effort).
        - Viewers are rejected with 403.
        - If an alternative has is_selected=True, that alternative's ID is
          written back to decisions.selected_alternative after insert.
        """
        _require_write(db, workspace_id=workspace_id, user_id=user_id)

        # Insert decision row
        decision_row = {
            "workspace_id": workspace_id,
            "title": data.title,
            "context": data.context,
            "rationale": data.rationale,
            "status": data.status,
            "tags": data.tags,
            "stakeholders": data.stakeholders,
            "review_date": data.review_date.isoformat() if data.review_date else None,
            "created_by": user_id,
        }
        d_resp = db.table("decisions").insert(decision_row).execute()
        decision = d_resp.data[0]

        # Insert alternatives
        alternatives: list[AlternativeResponse] = []
        selected_alt_id: str | None = None

        if data.alternatives:
            alt_rows = [
                {
                    "decision_id": decision["id"],
                    "title": alt.title,
                    "description": alt.description,
                    "pros": alt.pros,
                    "cons": alt.cons,
                    "is_selected": alt.is_selected,
                }
                for alt in data.alternatives
            ]
            alt_resp = db.table("alternatives").insert(alt_rows).execute()
            for row in alt_resp.data:
                a = _map_alternative(row)
                alternatives.append(a)
                if row.get("is_selected"):
                    selected_alt_id = row["id"]

        # Write back selected_alternative FK if one was marked
        if selected_alt_id:
            db.table("decisions").update({"selected_alternative": selected_alt_id}).eq("id", decision["id"]).execute()
            decision["selected_alternative"] = selected_alt_id

        creator = _fetch_user(db, user_id)
        return _map_decision(decision, creator, alternatives)

    @staticmethod
    def list_decisions(
        db: Client,
        *,
        workspace_id: str,
        user_id: str,
        filters: DecisionFilters,
    ) -> list[DecisionResponse]:
        """
        Return decisions in a workspace, with optional filtering:
        - status: exact match
        - tag: checks if tags array contains the value
        - creator_id: filter by who created the decision
        - keyword: case-insensitive search across title AND context
        """
        _get_role(db, workspace_id=workspace_id, user_id=user_id)  # ensures membership

        query = (
            db.table("decisions")
            .select("*, alternatives!alternatives_decision_id_fkey(*)")  # explicit FK to avoid ambiguous join
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
        )

        if filters.status:
            query = query.eq("status", filters.status)

        if filters.tag:
            query = query.contains("tags", [filters.tag])

        if filters.creator_id:
            query = query.eq("created_by", filters.creator_id)

        if filters.keyword:
            kw = filters.keyword.strip()
            query = query.or_(f"title.ilike.%{kw}%,context.ilike.%{kw}%")

        resp = query.execute()
        rows = resp.data or []

        if not rows:
            return []

        # Batch-fetch creator info to avoid N+1
        creator_ids = [r["created_by"] for r in rows]
        creators = _fetch_users_bulk(db, creator_ids)

        return [
            _map_decision(
                row,
                creator=creators[row["created_by"]],
                alternatives=[_map_alternative(a) for a in (row.get("alternatives") or [])],
            )
            for row in rows
        ]

    @staticmethod
    def get_decision(
        db: Client,
        *,
        decision_id: str,
        workspace_id: str,
        user_id: str,
    ) -> DecisionResponse:
        """
        Fetch a single decision with full detail:
        alternatives + outcome reviews included.
        """
        _get_role(db, workspace_id=workspace_id, user_id=user_id)

        resp = (
            db.table("decisions")
            .select("*, alternatives!alternatives_decision_id_fkey(*), outcome_reviews(*)")  # explicit FK
            .eq("id", decision_id)
            .eq("workspace_id", workspace_id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")

        row = resp.data[0]
        creator = _fetch_user(db, row["created_by"])
        alternatives = [_map_alternative(a) for a in (row.get("alternatives") or [])]
        reviews = [_map_review(r) for r in (row.get("outcome_reviews") or [])]
        return _map_decision(row, creator, alternatives, reviews)

    @staticmethod
    @staticmethod
    def update_decision(
        db: Client,
        *,
        decision_id: str,
        workspace_id: str,
        user_id: str,
        data: DecisionUpdate,
    ) -> DecisionResponse:
        """
        Partial update.
        - Viewers -> 403
        - Members can only update their OWN decisions
        - Admins/owners can update any decision
        - If alternatives are provided, existing ones are deleted and replaced.
        """
        role = _require_write(db, workspace_id=workspace_id, user_id=user_id)

        existing_resp = (
            db.table("decisions")
            .select("created_by, workspace_id")
            .eq("id", decision_id)
            .eq("workspace_id", workspace_id)
            .execute()
        )
        if not existing_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")

        existing = existing_resp.data[0]
        if role == "member" and existing["created_by"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Members can only edit their own decisions",
            )

        alternatives_data = data.alternatives

        updates = data.model_dump(exclude_none=True, exclude={"alternatives"})

        if "review_date" in updates and updates["review_date"]:
            updates["review_date"] = updates["review_date"].isoformat()

        if updates:
            db.table("decisions").update(updates).eq("id", decision_id).execute()

        if alternatives_data is not None:
            db.table("alternatives").delete().eq("decision_id", decision_id).execute()

            selected_alt_id: str | None = None

            if alternatives_data:
                alt_rows = [
                    {
                        "decision_id": decision_id,
                        "title": alt.title,
                        "description": alt.description,
                        "pros": alt.pros,
                        "cons": alt.cons,
                        "is_selected": alt.is_selected,
                    }
                    for alt in alternatives_data
                ]
                alt_resp = db.table("alternatives").insert(alt_rows).execute()
                for row in alt_resp.data:
                    if row.get("is_selected"):
                        selected_alt_id = row["id"]

            db.table("decisions").update(
                {"selected_alternative": selected_alt_id}
            ).eq("id", decision_id).execute()

        return DecisionService.get_decision(
            db, decision_id=decision_id, workspace_id=workspace_id, user_id=user_id
        )

    def delete_decision(
        db: Client,
        *,
        decision_id: str,
        workspace_id: str,
        user_id: str,
    ) -> None:
        """
        Hard-delete a decision and all its alternatives/reviews (cascade).
        Admin/owner only.
        """
        _require_admin(db, workspace_id=workspace_id, user_id=user_id)

        existing = (
            db.table("decisions")
            .select("id")
            .eq("id", decision_id)
            .eq("workspace_id", workspace_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")

        db.table("decisions").delete().eq("id", decision_id).execute()

    @staticmethod
    def add_review(
        db: Client,
        *,
        decision_id: str,
        workspace_id: str,
        user_id: str,
        data: OutcomeReviewCreate,
    ) -> OutcomeReviewResponse:
        """Add an outcome review. Requires write access."""
        _require_write(db, workspace_id=workspace_id, user_id=user_id)

        existing = (
            db.table("decisions")
            .select("id")
            .eq("id", decision_id)
            .eq("workspace_id", workspace_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")

        row = {
            "decision_id": decision_id,
            "actual_outcome": data.actual_outcome,
            "quality_score": data.quality_score,
            "lessons_learned": data.lessons_learned,
            "reviewed_by": user_id,
        }
        resp = db.table("outcome_reviews").insert(row).execute()
        return _map_review(resp.data[0])

    @staticmethod
    def submit_review(
        db: Client,
        *,
        decision_id: str,
        user_id: str,
        data: OutcomeReviewCreate,
    ) -> OutcomeReviewResponse:
        """
        Submit an outcome review for a decision.

        Validation rules:
        - User must be a workspace member with write access (not viewer).
        - Decision must have a review_date set and it must be today or earlier.
          If review_date is in the future, raises 422 with a clear message.
        - Only one review is allowed per decision (409 if already reviewed).
        - On success: inserts review and sets decision status to 'reviewed'.
        """
        # 1. Fetch decision to get workspace_id and review_date
        d_resp = (
            db.table("decisions")
            .select("id, workspace_id, review_date, status")
            .eq("id", decision_id)
            .execute()
        )
        if not d_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")
        decision = d_resp.data[0]

        # 2. Check write access
        _require_write(db, workspace_id=decision["workspace_id"], user_id=user_id)

        # 3. Check review_date is set and not in the future
        review_date_raw = decision.get("review_date")
        if not review_date_raw:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cannot review a decision that has no review_date set",
            )
        review_date = datetime.fromisoformat(review_date_raw.replace("Z", "+00:00"))
        today = datetime.now(timezone.utc)
        if review_date > today:
            diff_days = (review_date - today).days + 1
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Review date is {diff_days} day(s) in the future. "
                    "You can only submit a review on or after the scheduled review date."
                ),
            )

        # 4. Enforce one review per decision
        existing_review = (
            db.table("outcome_reviews")
            .select("id")
            .eq("decision_id", decision_id)
            .execute()
        )
        if existing_review.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This decision already has an outcome review",
            )

        # 5. Insert review
        row = {
            "decision_id": decision_id,
            "actual_outcome": data.actual_outcome,
            "quality_score": data.quality_score,
            "lessons_learned": data.lessons_learned,
            "reviewed_by": user_id,
        }
        review_resp = db.table("outcome_reviews").insert(row).execute()

        # 6. Update decision status to 'reviewed'
        db.table("decisions").update({"status": "reviewed"}).eq("id", decision_id).execute()

        return _map_review(review_resp.data[0])

    @staticmethod
    def get_review(
        db: Client,
        *,
        decision_id: str,
        user_id: str,
    ) -> OutcomeReviewResponse:
        """
        Fetch the outcome review for a decision.
        Raises 404 if the decision doesn't exist or has no review yet.
        """
        # Fetch decision to get workspace_id (for membership check)
        d_resp = (
            db.table("decisions")
            .select("workspace_id")
            .eq("id", decision_id)
            .execute()
        )
        if not d_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")

        _get_role(db, workspace_id=d_resp.data[0]["workspace_id"], user_id=user_id)

        review_resp = (
            db.table("outcome_reviews")
            .select("*")
            .eq("decision_id", decision_id)
            .execute()
        )
        if not review_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No outcome review found for this decision",
            )
        return _map_review(review_resp.data[0])

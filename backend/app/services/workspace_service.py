"""
WorkspaceService — Supabase implementation.
Uses the service_role client (bypasses RLS); access is enforced manually.
"""
from __future__ import annotations

import re
import secrets
import unicodedata
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.workspace import (
    InvitationCreate,
    InvitationResponse,
    WorkspaceCreate,
    WorkspaceMember,
    WorkspaceResponse,
    WorkspaceUpdate,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def generate_slug(name: str) -> str:
    """
    Convert a human-readable name to a URL-safe slug.

    Examples:
        "Acme Corp"        → "acme-corp"
        "My New Workspace" → "my-new-workspace"
        "R&D / 2024"       → "r-d-2024"
    """
    # Normalise unicode (e.g. accented chars → base chars)
    value = unicodedata.normalize("NFKD", name)
    value = value.encode("ascii", "ignore").decode("ascii")
    # Lowercase and replace any non-alphanumeric run with a single hyphen
    value = re.sub(r"[^a-z0-9]+", "-", value.lower())
    # Strip leading/trailing hyphens
    value = value.strip("-")
    return value or "workspace"


def _assert_member(
    db: Client,
    *,
    workspace_id: str,
    user_id: str,
    min_role: list[str] | None = None,
) -> dict:
    """Raise 403 if the user is not a member (or lacks the required role)."""
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
    member = resp.data[0]
    if min_role and member["role"] not in min_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return member


def _make_unique_slug(db: Client, base_slug: str) -> str:
    """
    Ensure a slug is unique by appending an incrementing suffix when needed.

    "acme-corp" → "acme-corp-2" → "acme-corp-3" …
    """
    candidate = base_slug
    counter = 2
    while True:
        existing = (
            db.table("workspaces").select("id").eq("slug", candidate).execute()
        )
        if not existing.data:
            return candidate
        candidate = f"{base_slug}-{counter}"
        counter += 1


def _row_to_response(ws: dict, role: str) -> WorkspaceResponse:
    return WorkspaceResponse(
        id=ws["id"],
        name=ws["name"],
        slug=ws["slug"],
        created_at=ws["created_at"],
        role=role,
    )


# ── Service ───────────────────────────────────────────────────────────────────

class WorkspaceService:

    @staticmethod
    def create_workspace(db: Client, *, user_id: str, data: WorkspaceCreate) -> WorkspaceResponse:
        """
        Insert a new workspace and add the creator as an *admin* member.

        - If ``data.slug`` is provided, it is used as-is (409 on duplicate).
        - If omitted, a slug is auto-generated from the name and made unique
          by appending a numeric suffix when needed.
        """
        if data.slug:
            # Explicit slug: fail fast on duplicate (caller chose it deliberately)
            existing = (
                db.table("workspaces").select("id").eq("slug", data.slug).execute()
            )
            if existing.data:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Slug '{data.slug}' is already taken",
                )
            slug = data.slug
        else:
            # Auto-generate and make unique silently
            slug = _make_unique_slug(db, generate_slug(data.name))

        ws_resp = (
            db.table("workspaces")
            .insert({"name": data.name, "slug": slug, "created_by": user_id})
            .execute()
        )
        ws = ws_resp.data[0]

        db.table("workspace_members").insert(
            {"workspace_id": ws["id"], "user_id": user_id, "role": "admin"}
        ).execute()

        return _row_to_response(ws, role="admin")

    @staticmethod
    def get_user_workspaces(db: Client, *, user_id: str) -> list[WorkspaceResponse]:
        """
        Return all workspaces the user belongs to, along with their role in each.
        """
        resp = (
            db.table("workspace_members")
            .select("role, workspace:workspaces(id, name, slug, created_at)")
            .eq("user_id", user_id)
            .execute()
        )
        result = []
        for row in resp.data:
            ws = row["workspace"]
            result.append(_row_to_response(ws, role=row["role"]))
        return result

    # ── Supporting CRUD (used by other routes) ────────────────────────────────

    @staticmethod
    def get(db: Client, *, workspace_id: str, user_id: str) -> WorkspaceResponse | None:
        """Fetch a single workspace if the user is a member."""
        member = (
            db.table("workspace_members")
            .select("role, workspace:workspaces(id, name, slug, created_at)")
            .eq("workspace_id", workspace_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not member.data:
            return None
        row = member.data[0]
        return _row_to_response(row["workspace"], role=row["role"])

    @staticmethod
    def update(
        db: Client, *, workspace_id: str, payload: WorkspaceUpdate, user_id: str
    ) -> WorkspaceResponse:
        """Update workspace name (admin+ only)."""
        _assert_member(db, workspace_id=workspace_id, user_id=user_id, min_role=["owner", "admin"])
        updates = payload.model_dump(exclude_none=True)
        resp = db.table("workspaces").update(updates).eq("id", workspace_id).execute()
        ws = resp.data[0]
        m = (
            db.table("workspace_members")
            .select("role")
            .eq("workspace_id", workspace_id)
            .eq("user_id", user_id)
            .execute()
        )
        return _row_to_response(ws, role=m.data[0]["role"])

    @staticmethod
    def delete(db: Client, *, workspace_id: str, user_id: str) -> None:
        """Delete a workspace (owner/admin only)."""
        _assert_member(db, workspace_id=workspace_id, user_id=user_id, min_role=["owner", "admin"])
        db.table("workspaces").delete().eq("id", workspace_id).execute()

    @staticmethod
    def list_members(db: Client, *, workspace_id: str, user_id: str) -> list[WorkspaceMember]:
        """Return all members of a workspace."""
        _assert_member(db, workspace_id=workspace_id, user_id=user_id)
        resp = (
            db.table("workspace_members")
            .select("user_id, role, created_at")
            .eq("workspace_id", workspace_id)
            .execute()
        )
        members: list[WorkspaceMember] = []
        for row in resp.data:
            joined_at = row.get("created_at")  # workspace_members.created_at = join date
            try:
                user = db.auth.admin.get_user_by_id(row["user_id"])
                u = user.user
                members.append(
                    WorkspaceMember(
                        user_id=u.id,
                        email=u.email or "",
                        name=u.user_metadata.get("name", u.email or ""),
                        role=row["role"],
                        joined_at=joined_at,
                    )
                )
            except Exception:
                members.append(
                    WorkspaceMember(
                        user_id=row["user_id"],
                        email="",
                        name="Unknown",
                        role=row["role"],
                        joined_at=joined_at,
                    )
                )
        return members

    # ── Invitation methods ────────────────────────────────────────────────────

    @staticmethod
    def create_invitation(
        db: Client,
        *,
        workspace_id: str,
        inviter_id: str,
        data: InvitationCreate,
    ) -> InvitationResponse:
        """
        Create a workspace invitation with a unique token valid for 7 days.

        Rules:
        - Inviter must be admin/owner (403 otherwise).
        - Cannot invite an email that already has a pending (non-expired) invitation.
        - Cannot invite someone who is already a member.
        """
        # 1. Check inviter is admin/owner
        member_resp = (
            db.table("workspace_members")
            .select("role")
            .eq("workspace_id", workspace_id)
            .eq("user_id", inviter_id)
            .execute()
        )
        if not member_resp.data:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this workspace")
        role = member_resp.data[0]["role"]
        if role not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can invite members",
            )

        # 2. Check for a still-pending, non-expired invitation for this email
        now_iso = datetime.now(timezone.utc).isoformat()
        pending = (
            db.table("workspace_invitations")
            .select("id")
            .eq("workspace_id", workspace_id)
            .eq("email", data.email)
            .eq("status", "pending")
            .gt("expires_at", now_iso)
            .execute()
        )
        if pending.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A pending invitation for {data.email} already exists",
            )

        # 3. Check if email already belongs to a member
        #    Find the user by email via admin API, then check workspace_members
        try:
            all_users = db.auth.admin.list_users()
            existing_user = next(
                (u for u in all_users if u.email and u.email.lower() == data.email.lower()),
                None,
            )
            if existing_user:
                already_member = (
                    db.table("workspace_members")
                    .select("id")
                    .eq("workspace_id", workspace_id)
                    .eq("user_id", existing_user.id)
                    .execute()
                )
                if already_member.data:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"{data.email} is already a member of this workspace",
                    )
        except HTTPException:
            raise
        except Exception:
            pass  # If user lookup fails, proceed — caught at accept time

        # 4. Generate token and insert invitation
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        row = {
            "workspace_id": workspace_id,
            "inviter_id": inviter_id,
            "email": data.email,
            "role": data.role,
            "token": token,
            "status": "pending",
            "expires_at": expires_at.isoformat(),
        }
        resp = db.table("workspace_invitations").insert(row).execute()
        inv = resp.data[0]

        return InvitationResponse(
            id=inv["id"],
            workspace_id=inv["workspace_id"],
            email=inv["email"],
            role=inv["role"],
            token=inv["token"],
            status=inv["status"],
            expires_at=inv["expires_at"],
            created_at=inv["created_at"],
        )

    @staticmethod
    def accept_invitation(
        db: Client,
        *,
        token: str,
        user_id: str,
    ) -> WorkspaceResponse:
        """
        Accept an invitation by its token.

        Flow:
        1. Look up the invitation — 404 if not found.
        2. If expires_at has passed → 410 Gone.
        3. If already accepted/revoked → 409 Conflict.
        4. Verify the authenticated user's email matches the invitation email.
        5. Check user is not already a member — clear 409 if so.
        6. Add user to workspace_members with the invited role.
        7. Mark invitation as accepted.
        """
        # 1. Fetch invitation
        inv_resp = (
            db.table("workspace_invitations")
            .select("*")
            .eq("token", token)
            .execute()
        )
        if not inv_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
        inv = inv_resp.data[0]

        # 2. Check expiry
        expires_at = datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This invitation has expired",
            )

        # 3. Check status
        if inv["status"] != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Invitation has already been {inv['status']}",
            )

        # 4. Verify user email matches invitation email
        try:
            user_resp = db.auth.admin.get_user_by_id(user_id)
            user_email = (user_resp.user.email or "").lower()
            if user_email != inv["email"].lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This invitation was sent to a different email address",
                )
        except HTTPException:
            raise
        except Exception:
            pass  # If we can't verify email, proceed (lenient fallback)

        # 5. Check not already a member
        already = (
            db.table("workspace_members")
            .select("id")
            .eq("workspace_id", inv["workspace_id"])
            .eq("user_id", user_id)
            .execute()
        )
        if already.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You are already a member of this workspace",
            )

        # 6. Add to workspace
        db.table("workspace_members").insert(
            {
                "workspace_id": inv["workspace_id"],
                "user_id": user_id,
                "role": inv["role"],
            }
        ).execute()

        # 7. Mark invitation accepted
        db.table("workspace_invitations").update({"status": "accepted"}).eq("id", inv["id"]).execute()

        # Return the workspace the user just joined
        ws_resp = db.table("workspaces").select("*").eq("id", inv["workspace_id"]).execute()
        ws = ws_resp.data[0]
        return WorkspaceResponse(
            id=ws["id"],
            name=ws["name"],
            slug=ws["slug"],
            created_at=ws["created_at"],
            role=inv["role"],
        )

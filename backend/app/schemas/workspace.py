from __future__ import annotations

import re
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, field_validator


WorkspaceRole = Literal["owner", "admin", "member", "viewer"]

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


# ── Workspace request schemas ──────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    name: str
    slug: Optional[str] = None  # auto-generated from name if omitted

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty")
        return v

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if not _SLUG_RE.match(v):
            raise ValueError(
                "Slug must be lowercase alphanumeric with hyphens only (e.g. acme-corp)"
            )
        return v


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None


# ── Workspace response schemas ─────────────────────────────────────────────────

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_at: datetime
    role: WorkspaceRole

    model_config = {"from_attributes": True}


class WorkspaceMember(BaseModel):
    user_id: str
    email: str
    name: str
    role: WorkspaceRole
    joined_at: Optional[datetime] = None


# ── Invitation schemas ─────────────────────────────────────────────────────────

InvitationStatus = Literal["pending", "accepted", "revoked"]


class InvitationCreate(BaseModel):
    """Body for POST /workspaces/{id}/invite"""
    email: str
    role: WorkspaceRole = "member"

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")
        return v

    @field_validator("role")
    @classmethod
    def role_not_owner(cls, v: str) -> str:
        if v == "owner":
            raise ValueError("Cannot invite someone as owner")
        return v


class InvitationResponse(BaseModel):
    """Returned after creating an invitation."""
    id: str
    workspace_id: str
    email: str
    role: WorkspaceRole
    token: str
    status: InvitationStatus
    expires_at: datetime
    created_at: datetime


class JoinRequest(BaseModel):
    """Body for POST /workspaces/join"""
    token: str

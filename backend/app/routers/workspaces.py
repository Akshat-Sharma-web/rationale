from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import verify_token
from app.database import supabase
from app.schemas.workspace import (
    InvitationCreate,
    InvitationResponse,
    JoinRequest,
    WorkspaceCreate,
    WorkspaceMember,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


# ── Workspace CRUD ────────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a workspace",
    description=(
        "Creates a new workspace and adds the authenticated user as an **admin** member. "
        "If `slug` is omitted it is auto-generated from the name. "
        "Returns **409** if the requested slug is already taken."
    ),
)
def create_workspace(
    payload: WorkspaceCreate,
    user_id: str = Depends(verify_token),
) -> WorkspaceResponse:
    return WorkspaceService.create_workspace(supabase, user_id=user_id, data=payload)


@router.get(
    "/",
    response_model=list[WorkspaceResponse],
    summary="List my workspaces",
    description="Returns every workspace the authenticated user is a member of, with their role.",
)
def list_workspaces(
    user_id: str = Depends(verify_token),
) -> list[WorkspaceResponse]:
    return WorkspaceService.get_user_workspaces(supabase, user_id=user_id)


# ── Invitation: join (MUST be before /{workspace_id} to avoid route shadowing) ─

@router.post(
    "/join",
    response_model=WorkspaceResponse,
    summary="Join via invitation token",
    description=(
        "Accept a workspace invitation using the token received via email. "
        "Returns the workspace the user has joined. "
        "Returns **410** if the token is expired, **409** if already a member, "
        "**403** if the email doesn't match."
    ),
)
def join_workspace(
    payload: JoinRequest,
    user_id: str = Depends(verify_token),
) -> WorkspaceResponse:
    return WorkspaceService.accept_invitation(supabase, token=payload.token, user_id=user_id)


# ── Single workspace operations ───────────────────────────────────────────────

@router.get(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Get a workspace",
)
def get_workspace(
    workspace_id: str,
    user_id: str = Depends(verify_token),
) -> WorkspaceResponse:
    workspace = WorkspaceService.get(supabase, workspace_id=workspace_id, user_id=user_id)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return workspace


@router.patch(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Update a workspace",
    description="Update workspace name. Requires admin role or above.",
)
def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdate,
    user_id: str = Depends(verify_token),
) -> WorkspaceResponse:
    return WorkspaceService.update(supabase, workspace_id=workspace_id, payload=payload, user_id=user_id)


@router.delete(
    "/{workspace_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a workspace",
    description="Permanently delete a workspace. Requires admin role or above.",
)
def delete_workspace(
    workspace_id: str,
    user_id: str = Depends(verify_token),
) -> None:
    WorkspaceService.delete(supabase, workspace_id=workspace_id, user_id=user_id)


# ── Members & Invitations ─────────────────────────────────────────────────────

@router.get(
    "/{workspace_id}/members",
    response_model=list[WorkspaceMember],
    summary="List workspace members",
    description="Returns all members with their roles. Any member can view.",
)
def list_members(
    workspace_id: str,
    user_id: str = Depends(verify_token),
) -> list[WorkspaceMember]:
    return WorkspaceService.list_members(supabase, workspace_id=workspace_id, user_id=user_id)


@router.post(
    "/{workspace_id}/invite",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a user",
    description=(
        "Create a 7-day invitation token for an email address. "
        "Returns the invitation including the token to share with the invitee. "
        "**Admin/owner only.** Returns **409** if a pending invite already exists "
        "for that email, or if the email is already a member."
    ),
)
def invite_member(
    workspace_id: str,
    payload: InvitationCreate,
    user_id: str = Depends(verify_token),
) -> InvitationResponse:
    return WorkspaceService.create_invitation(
        supabase,
        workspace_id=workspace_id,
        inviter_id=user_id,
        data=payload,
    )

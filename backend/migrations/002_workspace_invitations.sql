-- ============================================================
--  Migration 002: Workspace Invitations
--  Run in Supabase SQL Editor → New query
-- ============================================================

create table if not exists public.workspace_invitations (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  inviter_id    uuid not null references auth.users(id) on delete cascade,
  email         text not null,
  role          public.workspace_role not null default 'member',
  token         text not null unique,
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'revoked')),
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

alter table public.workspace_invitations enable row level security;

-- Indexes for fast token lookups and listing by workspace / email
create index if not exists idx_invitations_token
  on public.workspace_invitations(token);

create index if not exists idx_invitations_workspace
  on public.workspace_invitations(workspace_id);

create index if not exists idx_invitations_email
  on public.workspace_invitations(email);

-- RLS: members of the workspace can see invitations
create policy "Workspace members can view invitations"
  on public.workspace_invitations for select
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_id = workspace_invitations.workspace_id
        and user_id = auth.uid()
    )
  );

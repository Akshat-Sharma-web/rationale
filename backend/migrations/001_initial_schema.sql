-- ============================================================
--  Rationale — Database Schema
--  Run this entire file in Supabase SQL Editor
-- ============================================================


-- ── 0. Extensions ────────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ── 1. Workspaces ────────────────────────────────────────────
create table if not exists public.workspaces (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users(id) on delete cascade
);

alter table public.workspaces enable row level security;


-- ── 2. Workspace Members ──────────────────────────────────────
create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');

create table if not exists public.workspace_members (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          public.workspace_role not null default 'member',
  created_at    timestamptz not null default now(),

  unique (workspace_id, user_id)
);

alter table public.workspace_members enable row level security;


-- ── 3. Decisions ─────────────────────────────────────────────
create type public.decision_status as enum ('draft', 'active', 'superseded', 'archived');

create table if not exists public.decisions (
  id                    uuid primary key default uuid_generate_v4(),
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  title                 text not null,
  context               text not null default '',
  rationale             text not null default '',
  status                public.decision_status not null default 'draft',
  tags                  text[] not null default '{}',
  stakeholders          text[] not null default '{}',
  selected_alternative  uuid,           -- FK added after alternatives table exists
  review_date           timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid not null references auth.users(id) on delete cascade
);

alter table public.decisions enable row level security;


-- ── 4. Alternatives ───────────────────────────────────────────
create table if not exists public.alternatives (
  id           uuid primary key default uuid_generate_v4(),
  decision_id  uuid not null references public.decisions(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  pros         text[] not null default '{}',
  cons         text[] not null default '{}',
  is_selected  boolean not null default false
);

alter table public.alternatives enable row level security;

-- Now add the FK from decisions.selected_alternative → alternatives
alter table public.decisions
  add constraint fk_selected_alternative
  foreign key (selected_alternative)
  references public.alternatives(id)
  on delete set null
  deferrable initially deferred;


-- ── 5. Outcome Reviews ────────────────────────────────────────
create table if not exists public.outcome_reviews (
  id               uuid primary key default uuid_generate_v4(),
  decision_id      uuid not null references public.decisions(id) on delete cascade,
  actual_outcome   text not null,
  quality_score    integer not null check (quality_score between 1 and 10),
  lessons_learned  text not null default '',
  reviewed_at      timestamptz not null default now(),
  reviewed_by      uuid not null references auth.users(id) on delete cascade
);

alter table public.outcome_reviews enable row level security;


-- ── 6. Indexes (performance) ──────────────────────────────────
create index if not exists idx_workspace_members_user    on public.workspace_members(user_id);
create index if not exists idx_workspace_members_ws      on public.workspace_members(workspace_id);
create index if not exists idx_decisions_workspace       on public.decisions(workspace_id);
create index if not exists idx_decisions_status          on public.decisions(status);
create index if not exists idx_alternatives_decision     on public.alternatives(decision_id);
create index if not exists idx_outcome_reviews_decision  on public.outcome_reviews(decision_id);


-- ── 7. Row Level Security Policies ───────────────────────────
--
--  The FastAPI backend uses the service_role key which bypasses RLS,
--  so these policies protect against any direct client access.
--

-- workspaces: visible to members only
create policy "Members can view their workspaces"
  on public.workspaces for select
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_id = id
        and user_id = auth.uid()
    )
  );

-- workspace_members: visible to members of the same workspace
create policy "Members can view workspace membership"
  on public.workspace_members for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- decisions: visible to workspace members
create policy "Workspace members can view decisions"
  on public.decisions for select
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_id = decisions.workspace_id
        and user_id = auth.uid()
    )
  );

-- alternatives: visible if parent decision is visible
create policy "Workspace members can view alternatives"
  on public.alternatives for select
  using (
    exists (
      select 1
      from public.decisions d
      join public.workspace_members wm on wm.workspace_id = d.workspace_id
      where d.id = alternatives.decision_id
        and wm.user_id = auth.uid()
    )
  );

-- outcome_reviews: visible if parent decision is visible
create policy "Workspace members can view outcome reviews"
  on public.outcome_reviews for select
  using (
    exists (
      select 1
      from public.decisions d
      join public.workspace_members wm on wm.workspace_id = d.workspace_id
      where d.id = outcome_reviews.decision_id
        and wm.user_id = auth.uid()
    )
  );

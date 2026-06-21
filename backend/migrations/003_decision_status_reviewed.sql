-- ============================================================
--  Migration 003: Add 'reviewed' to decision_status enum
--  Run in Supabase SQL Editor → New query
-- ============================================================

-- PostgreSQL requires ALTER TYPE ... ADD VALUE to run outside a transaction.
-- Supabase SQL Editor runs each statement individually, so this works as-is.

ALTER TYPE public.decision_status ADD VALUE IF NOT EXISTS 'reviewed';

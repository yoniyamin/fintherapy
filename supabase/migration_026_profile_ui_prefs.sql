------------------------------------------------------------------------
-- Migration 026: Add ui_prefs JSONB column to profiles
-- Stores per-user UI preferences (e.g. comparison view mode)
------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

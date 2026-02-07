-- Phase 1a: Add "driver" to app_role enum
-- This must be in a separate transaction before using the new value
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';
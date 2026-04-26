-- 1. Add 'office' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'office';

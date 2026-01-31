-- Table to track scheduled user deletions
CREATE TABLE public.scheduled_user_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT,
  scheduled_by UUID NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  execute_after TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 day'),
  reason TEXT,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_user_deletions ENABLE ROW LEVEL SECURITY;

-- Only admins can view scheduled deletions
CREATE POLICY "Admins can view scheduled deletions"
ON public.scheduled_user_deletions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert scheduled deletions
CREATE POLICY "Admins can insert scheduled deletions"
ON public.scheduled_user_deletions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update (cancel) scheduled deletions
CREATE POLICY "Admins can update scheduled deletions"
ON public.scheduled_user_deletions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Index for efficient querying of pending deletions
CREATE INDEX idx_scheduled_deletions_pending 
ON public.scheduled_user_deletions (execute_after) 
WHERE is_cancelled = false AND executed_at IS NULL;
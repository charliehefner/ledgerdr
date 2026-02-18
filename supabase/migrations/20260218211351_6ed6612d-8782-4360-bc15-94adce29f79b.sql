ALTER TABLE public.transactions
ADD COLUMN cost_center text NOT NULL DEFAULT 'general';
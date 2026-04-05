
-- Create telegram_recipients table
CREATE TABLE public.telegram_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  label text NOT NULL DEFAULT '',
  categories text[] NOT NULL DEFAULT ARRAY['all'],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_recipients ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view telegram recipients"
  ON public.telegram_recipients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create telegram recipients"
  ON public.telegram_recipients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update telegram recipients"
  ON public.telegram_recipients FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete telegram recipients"
  ON public.telegram_recipients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Migrate existing chat_id from notification_settings
INSERT INTO public.telegram_recipients (chat_id, label, categories)
SELECT value, 'Primary', ARRAY['all']
FROM public.notification_settings
WHERE key = 'telegram_chat_id' AND value IS NOT NULL AND value != ''
ON CONFLICT DO NOTHING;

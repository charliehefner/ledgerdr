-- Add cedula attachment column to jornaleros and service_providers
ALTER TABLE public.jornaleros ADD COLUMN IF NOT EXISTS cedula_attachment_url TEXT;
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS cedula_attachment_url TEXT;

-- Create private bucket for cedula scans
INSERT INTO storage.buckets (id, name, public)
VALUES ('cedula-attachments', 'cedula-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies: authenticated users can read/write within this bucket
CREATE POLICY "Authenticated can view cedula attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cedula-attachments');

CREATE POLICY "Authenticated can upload cedula attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cedula-attachments');

CREATE POLICY "Authenticated can update cedula attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'cedula-attachments');

CREATE POLICY "Authenticated can delete cedula attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cedula-attachments');
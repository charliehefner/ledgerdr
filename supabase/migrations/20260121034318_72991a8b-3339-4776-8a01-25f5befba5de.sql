-- Create storage bucket for transaction attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-attachments', 'transaction-attachments', true);

-- Allow anyone to view attachments (public bucket)
CREATE POLICY "Public can view transaction attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'transaction-attachments');

-- Allow authenticated users to upload attachments
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'transaction-attachments');

-- Allow authenticated users to update their attachments
CREATE POLICY "Authenticated users can update attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'transaction-attachments');

-- Allow authenticated users to delete attachments
CREATE POLICY "Authenticated users can delete attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'transaction-attachments');
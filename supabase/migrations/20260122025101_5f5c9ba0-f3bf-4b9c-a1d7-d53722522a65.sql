-- Fix 1: Make the storage bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'transaction-attachments';

-- Fix 2: Drop existing overly permissive policies on transaction_attachments
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Authenticated users can update attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Authenticated users can insert attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Admins can delete attachments" ON public.transaction_attachments;

-- Fix 3: Create proper RLS policies for transaction_attachments
-- For this app, all authenticated users work on the same set of transactions (small team)
-- Admins have full access, accountants have read-only access to attachments

-- Admins can do everything
CREATE POLICY "Admins have full access to attachments" 
ON public.transaction_attachments 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Accountants can only view attachments (read-only)
CREATE POLICY "Accountants can view attachments" 
ON public.transaction_attachments 
FOR SELECT 
USING (has_role(auth.uid(), 'accountant'::app_role));

-- Accountants can insert new attachments
CREATE POLICY "Accountants can insert attachments" 
ON public.transaction_attachments 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

-- Fix 4: Add storage policies for authenticated access to objects
-- First drop any existing policies on storage.objects for this bucket
DROP POLICY IF EXISTS "Users access own transaction files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;

-- Authenticated users with a role can view files in the bucket
CREATE POLICY "Authenticated users can view attachment files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'transaction-attachments' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))
);

-- Authenticated users with a role can upload files
CREATE POLICY "Authenticated users can upload attachment files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'transaction-attachments' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))
);

-- Admins can update files
CREATE POLICY "Admins can update attachment files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'transaction-attachments' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can delete files
CREATE POLICY "Admins can delete attachment files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'transaction-attachments' AND
  has_role(auth.uid(), 'admin'::app_role)
);
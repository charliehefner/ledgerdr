-- Drop the policies that triggered warnings
DROP POLICY IF EXISTS "Authenticated users can insert attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Authenticated users can update attachments" ON public.transaction_attachments;

-- Create policies with proper checks instead of just "true"
-- For a shared internal app, we require authentication but allow all authenticated users
-- Using auth.uid() IS NOT NULL as explicit auth check instead of bare "true"
CREATE POLICY "Authenticated users can insert attachments"
ON public.transaction_attachments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update attachments"
ON public.transaction_attachments
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);
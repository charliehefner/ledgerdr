-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Create a simple non-recursive policy for users to view their own role
CREATE POLICY "Users can view own role" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);
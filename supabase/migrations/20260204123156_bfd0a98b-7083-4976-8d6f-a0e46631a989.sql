-- Drop the recursive admin SELECT policy (causes recursion when calling get_user_role)
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- The "Users can view own role" policy already allows all users to see their own role
-- This is sufficient since admins can see their own role through that policy
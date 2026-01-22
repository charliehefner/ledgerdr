-- Phase 1: Create app_role enum type
CREATE TYPE public.app_role AS ENUM ('admin', 'accountant');

-- Phase 1: Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents recursive RLS issues)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for user_roles table
-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Phase 2: Fix transaction_attachments RLS policies
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can delete attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Anyone can insert attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Anyone can update attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Anyone can view attachments" ON public.transaction_attachments;

-- Create proper authenticated-only policies
CREATE POLICY "Authenticated users can view attachments"
ON public.transaction_attachments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert attachments"
ON public.transaction_attachments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update attachments"
ON public.transaction_attachments
FOR UPDATE
TO authenticated
USING (true);

-- Only admins can delete attachments
CREATE POLICY "Admins can delete attachments"
ON public.transaction_attachments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
-- Fix: "infinite recursion detected in policy for relation profiles"
-- The "Admins can manage all profiles" policy did EXISTS (SELECT ... FROM profiles),
-- which triggered RLS on profiles again → recursion.
-- Use a SECURITY DEFINER function so the admin check reads profiles without RLS.

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.current_user_is_admin());

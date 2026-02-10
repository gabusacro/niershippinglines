-- Allow new users to insert their own profile row after signup (id = auth.uid())
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

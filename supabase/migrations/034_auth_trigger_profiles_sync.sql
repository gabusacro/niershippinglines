-- Ensure profile is created when auth user signs up (links profiles.id to auth.users.id)
-- Syncs full_name from raw_user_meta_data so profile has the name for easy identification

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    'passenger'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(TRIM(EXCLUDED.full_name), ''), public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Create trigger on auth.users if not exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

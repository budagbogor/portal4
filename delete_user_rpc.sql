-- Function to delete user from auth.users (requires SECURITY DEFINER)
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.delete_user_by_email(user_email TEXT)
RETURNS VOID AS $$
BEGIN
  -- Delete from auth.users (Cascades to profiles usually, but we make sure)
  DELETE FROM auth.users WHERE email = user_email;
  
  -- If you want to be double sure, delete from profiles too (though FK usually handles it)
  -- DELETE FROM public.profiles WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users (admin only ideally, but for now authenticated)
GRANT EXECUTE ON FUNCTION public.delete_user_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_by_email(TEXT) TO service_role;

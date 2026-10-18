ALTER FUNCTION public.update_cached_post_like_count SET search_path = public;
ALTER FUNCTION public.update_cached_comment_like_count SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.update_cached_post_like_count FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_cached_comment_like_count FROM anon, authenticated;
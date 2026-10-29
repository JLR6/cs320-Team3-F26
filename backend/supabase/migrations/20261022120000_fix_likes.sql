-- Fix for the liking endpoints.
--
-- The like_count triggers (see 20261008141200_create_initial_tables.sql) update
-- posts / post_comments. RLS only lets the owner update those rows, so when someone
-- likes another user's post the count update was silently blocked. Run the trigger
-- functions as their owner so the cached count is always kept in sync.
--
-- This is safe because 20261009185422_fix_cache_function_security.sql already pins
-- their search_path and revokes EXECUTE from anon/authenticated, so they can only
-- run as triggers.
--
-- The one-like-per-user primary keys on post_likes / comment_likes are added in
-- 20261014145534_create_family_tables.sql, so they are not repeated here.
ALTER FUNCTION public.update_cached_post_like_count() SECURITY DEFINER;
ALTER FUNCTION public.update_cached_comment_like_count() SECURITY DEFINER;

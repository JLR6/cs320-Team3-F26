-- Fixes needed for the liking endpoints.

-- 1. A user can only like a post/comment once.
--    Remove any duplicate rows first so the constraint can be added.
DELETE FROM public.post_likes a
USING public.post_likes b
WHERE a.ctid < b.ctid
  AND a.post_id = b.post_id
  AND a.user_id = b.user_id;

DELETE FROM public.comment_likes a
USING public.comment_likes b
WHERE a.ctid < b.ctid
  AND a.comment_id = b.comment_id
  AND a.user_id = b.user_id;

ALTER TABLE public.post_likes
  ADD CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id);

ALTER TABLE public.comment_likes
  ADD CONSTRAINT comment_likes_pkey PRIMARY KEY (comment_id, user_id);

-- 2. The like_count triggers update posts / post_comments. RLS only lets the
--    owner update those rows, so when someone likes another user's post the
--    count update was silently blocked. Run the trigger functions as their
--    owner so the cached count is always kept in sync.
ALTER FUNCTION public.update_cached_post_like_count() SECURITY DEFINER;
ALTER FUNCTION public.update_cached_comment_like_count() SECURITY DEFINER;

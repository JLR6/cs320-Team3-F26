ALTER TABLE public.posts
    ADD COLUMN user_space_complexity TEXT,
    ADD COLUMN solution_url TEXT;

-- Refresh the view so following feeds include the new post columns.
CREATE OR REPLACE VIEW public.following_posts
WITH (security_invoker = true) AS
SELECT posts.*
FROM public.posts AS posts
WHERE EXISTS (
    SELECT 1
    FROM public.followers AS follows
    WHERE follows.follower_id = (SELECT auth.uid())
      AND follows.following_id = posts.user_id
);

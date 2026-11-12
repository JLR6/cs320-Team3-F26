CREATE INDEX followers_follower_following_idx
    ON public.followers (follower_id, following_id);

CREATE VIEW public.following_posts
WITH (security_invoker = true) AS
SELECT posts.*
FROM public.posts AS posts
WHERE EXISTS (
    SELECT 1
    FROM public.followers AS follows
    WHERE follows.follower_id = (SELECT auth.uid())
      AND follows.following_id = posts.user_id
);

REVOKE ALL ON public.following_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.following_posts TO authenticated;

-- Assemble each post under the caller's permissions, including their like state.
CREATE VIEW public.post_details
WITH (security_invoker = true) AS
SELECT
    p.*,
    p.post_id AS id,
    jsonb_build_object(
        'id', p.user_id,
        'username', (SELECT u.username FROM public.users u WHERE u.user_id = p.user_id),
        'profilePicture', (SELECT u.profile_picture FROM public.users u WHERE u.user_id = p.user_id)
    ) AS author,
    -- An expression keeps problem_number as the sole inferred FK for embeds.
    (p.problem_number + 0) AS "problemNumber",
    (SELECT problem_title FROM public.problems WHERE problem_number = p.problem_number) AS "problemName",
    (SELECT problem_difficulty FROM public.problems WHERE problem_number = p.problem_number) AS difficulty,
    (SELECT problem_link FROM public.problems WHERE problem_number = p.problem_number) AS "problemLink",
    p.post_description AS description,
    ARRAY(
        SELECT t.tag_name
        FROM public.problem_tags pt
        JOIN public.tags t ON t.tag_id = pt.tag_id
        WHERE pt.problem_number = p.problem_number
        ORDER BY t.tag_name
    ) AS tags,
    p.user_time_complexity AS "timeComplexity",
    p.user_space_complexity AS "spaceComplexity",
    p.solution_url AS "solutionUrl",
    COALESCE(p.like_count, 0) AS "likeCount",
    EXISTS (
        SELECT 1 FROM public.post_likes l
        WHERE l.post_id = p.post_id AND l.user_id = (SELECT auth.uid())
    ) AS "likedByMe",
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', c.comment_id,
            'postId', c.post_id,
            'author', jsonb_build_object(
                'id', c.user_id,
                'username', (SELECT u.username FROM public.users u WHERE u.user_id = c.user_id),
                'profilePicture', (SELECT u.profile_picture FROM public.users u WHERE u.user_id = c.user_id)
            ),
            'text', c.comment_text,
            'likeCount', COALESCE(c.like_count, 0),
            'createdAt', c.created_at,
            'updatedAt', c.modified_at
        ) ORDER BY c.created_at NULLS LAST, c.comment_id)
        FROM public.post_comments c WHERE c.post_id = p.post_id
    ), '[]'::jsonb) AS comments,
    p.created_at AS "createdAt",
    p.updated_at AS "updatedAt"
FROM public.posts p;

CREATE VIEW public.following_post_details
WITH (security_invoker = true) AS
SELECT p.*
FROM public.post_details p
WHERE EXISTS (
    SELECT 1 FROM public.followers f
    WHERE f.follower_id = (SELECT auth.uid()) AND f.following_id = p.user_id
);

REVOKE ALL ON public.post_details, public.following_post_details FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.post_details, public.following_post_details TO authenticated;

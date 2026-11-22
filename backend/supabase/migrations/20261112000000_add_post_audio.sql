-- Audio recordings on posts (backend/modules/post-audio).
--
-- A post can have one optional audio file, e.g. the author talking through their solution.
-- Files live in the Supabase Storage bucket "PostAudio" at <user_id>/<post_id>-<timestamp>.<ext>;
-- posts.audio_path stores that path. The bucket is public-read, like images on most social
-- apps, so the frontend can play a file straight from its URL without calling the backend.
-- Storage docs: https://supabase.com/docs/guides/storage
--
-- Writes are restricted by Storage RLS: you can only upload, replace or delete files inside
-- your own folder (the first path segment must be your user id).
-- https://supabase.com/docs/guides/storage/security/access-control

ALTER TABLE public.posts ADD COLUMN audio_path TEXT;

-- 10 MB limit (about 10 minutes of compressed speech) and audio types only. Storage rejects
-- anything else even if a client skips the backend.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'PostAudio',
    'PostAudio',
    true,
    10485760,
    ARRAY['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav']
)
ON CONFLICT (id) DO NOTHING;

-- storage.foldername(name) splits "user-id/file.webm" into {"user-id"}; [1] is the folder.
CREATE POLICY "Users can upload audio to their own folder" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'PostAudio' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- Needed so uploads can check for an existing file and so users can list their own files.
-- Anyone can still PLAY files through the public URL; this only covers API access.
CREATE POLICY "Users can see audio objects in their own folder" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'PostAudio' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Users can replace audio in their own folder" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'PostAudio' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
    WITH CHECK (bucket_id = 'PostAudio' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Users can delete audio in their own folder" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'PostAudio' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- Recreate the post views so they include "audioPath".
-- A view's "p.*" is fixed when the view is created, so adding a column to posts means the
-- views must be dropped and created again. The definition below is the same as in
-- 20261108010000_add_post_details_views.sql, plus the "audioPath" line.
DROP VIEW public.following_post_details;
DROP VIEW public.post_details;

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
    p.audio_path AS "audioPath",
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

-- Run as postgres against disposable Supabase with ON_ERROR_STOP=1.
BEGIN;

INSERT INTO auth.users (id) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.users (user_id, username, email) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Viewer', 'viewer-private@example.test'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Author', 'author-private@example.test');
INSERT INTO public.problems (problem_number, problem_link, problem_title, problem_difficulty)
VALUES (-2147483648, 'https://example.test/problem', 'A problem', 'Easy');
INSERT INTO public.posts (post_id, user_id, problem_number, user_time_complexity,
                          user_space_complexity, solution_url)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', -2147483648,
        'O(n)', 'O(1)', 'https://example.test/solution');
INSERT INTO public.post_likes (post_id, user_id)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.post_comments (post_id, user_id, comment_text)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A comment');
INSERT INTO public.followers (follower_id, following_id)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $$
DECLARE
    detail jsonb;
BEGIN
    SELECT to_jsonb(p) INTO detail FROM public.following_post_details p
    WHERE post_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    IF detail IS NULL OR NOT detail ?& ARRAY[
        'id', 'author', 'problemNumber', 'problemName', 'difficulty', 'problemLink',
        'description', 'tags', 'timeComplexity', 'spaceComplexity', 'solutionUrl',
        'likeCount', 'likedByMe', 'comments', 'createdAt', 'updatedAt'
    ] THEN
        RAISE EXCEPTION 'Post response is missing UI fields';
    END IF;
    IF detail ->> 'problemName' IS DISTINCT FROM 'A problem'
        OR detail ->> 'difficulty' IS DISTINCT FROM 'Easy'
        OR detail ->> 'problemLink' IS DISTINCT FROM 'https://example.test/problem'
        OR detail ->> 'timeComplexity' IS DISTINCT FROM 'O(n)'
        OR detail ->> 'spaceComplexity' IS DISTINCT FROM 'O(1)'
        OR detail ->> 'solutionUrl' IS DISTINCT FROM 'https://example.test/solution'
        OR detail ->> 'likedByMe' IS DISTINCT FROM 'true'
        OR detail -> 'tags' IS DISTINCT FROM '[]'::jsonb
        OR detail -> 'author' ->> 'username' IS DISTINCT FROM 'Author'
        OR detail -> 'comments' -> 0 ->> 'text' IS DISTINCT FROM 'A comment'
        OR detail -> 'comments' -> 0 -> 'author' ->> 'username' IS DISTINCT FROM 'Viewer'
    THEN
        RAISE EXCEPTION 'Post response contains incorrect details';
    END IF;
    IF detail::text LIKE '%private@example.test%' THEN
        RAISE EXCEPTION 'Post response exposed a private email';
    END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
DO $$
BEGIN
    IF (SELECT "likedByMe" FROM public.post_details
        WHERE post_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'Like state leaked between callers';
    END IF;
    IF has_table_privilege('anon', 'public.post_details', 'select')
        OR has_table_privilege('authenticated', 'public.post_details', 'update') THEN
        RAISE EXCEPTION 'Post details view permissions are incorrect';
    END IF;
END $$;

ROLLBACK;

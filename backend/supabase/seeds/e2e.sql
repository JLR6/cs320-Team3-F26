-- Run after migrations on a disposable local Supabase database, as postgres.
-- From the repository root, start the root Supabase project (it has the family
-- migrations), then run:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/supabase/seeds/e2e.sql
-- Use the local DB URL from "supabase status" for DATABASE_URL.
--
-- Sign in as e2e-user-1@example.test through e2e-user-5@example.test.
-- Shared test password: LocalE2ePassword123!
-- User 1 owns the family, users 2 and 3 are members, and users 4 and 5 are outsiders.
-- Re-running inserts missing fixtures. Use a fresh database for a clean baseline.

begin;

create extension if not exists pgcrypto with schema extensions;
set local search_path = pg_catalog, extensions, public;

create temporary table e2e_seed_users on commit drop as
select
    n as user_number,
    format('e2e00000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid as user_id,
    format('e2e_user_%s', n) as username,
    format('e2e-user-%s@example.test', n) as email
from generate_series(1, 5) as users(n);

insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current, email_change,
    phone_change, phone_change_token, reauthentication_token, created_at, updated_at
)
select
    user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    email, crypt('LocalE2ePassword123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('username', username),
    '', '', '', '', '', '', '', '', now(), now()
from e2e_seed_users
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
select
    user_id::text, user_id,
    jsonb_build_object('sub', user_id, 'email', email, 'email_verified', true),
    'email', now(), now()
from e2e_seed_users
on conflict (provider_id, provider) do nothing;

insert into public.users (user_id, username, email)
select user_id, username, email
from e2e_seed_users
on conflict (user_id) do nothing;

insert into public.problems (
    problem_number, problem_link, problem_title, problem_description, problem_difficulty, problem_tags
)
select
    900000 + n, format('https://example.test/problems/%s', 900000 + n),
    title, description, difficulty, tags
from (values
    ( 1, 'Pair With Target Sum', 'Find two numbers whose sum matches the target.', 'Easy', array['Array', 'Hash Table']),
    ( 2, 'Balanced Delimiters', 'Check whether brackets are paired in order.', 'Easy', array['String', 'Stack']),
    ( 3, 'Merge Time Windows', 'Combine overlapping intervals.', 'Medium', array['Array', 'Sorting']),
    ( 4, 'Shortest Word Chain', 'Find the fewest single-letter changes between two words.', 'Hard', array['String', 'Graph']),
    ( 5, 'Find in Sorted List', 'Return the position of a target in a sorted array.', 'Easy', array['Array', 'Binary Search']),
    ( 6, 'Longest Unique Slice', 'Find the longest substring with no repeated characters.', 'Medium', array['String', 'Sliding Window']),
    ( 7, 'Group Anagrams', 'Group words that contain the same letters.', 'Medium', array['String', 'Hash Table']),
    ( 8, 'Reverse a List', 'Reverse a singly linked list.', 'Easy', array['Linked List']),
    ( 9, 'Combine Sorted Streams', 'Merge multiple sorted lists into one sorted list.', 'Hard', array['Linked List', 'Heap']),
    (10, 'Count Grid Regions', 'Count the connected regions in a grid.', 'Medium', array['Graph', 'Depth-First Search']),
    (11, 'Array Running Totals', 'Return the sum of the prefix ending at each position.', 'Easy', array['Array', 'Prefix Sum']),
    (12, 'Compress Repeated Letters', 'Encode consecutive equal letters as runs.', 'Easy', array['String']),
    (13, 'Validate a Search Tree', 'Check whether a tree satisfies binary search ordering.', 'Medium', array['Tree']),
    (14, 'Maximum Tree Path', 'Find the largest sum over paths between nodes in a tree.', 'Hard', array['Tree', 'Dynamic Programming']),
    (15, 'Fewest Coins', 'Find the minimum number of coins that make a target total.', 'Medium', array['Array', 'Dynamic Programming']),
    (16, 'First Unique Letter', 'Find the first character that occurs exactly once.', 'Easy', array['String', 'Hash Table']),
    (17, 'Nearest Grid Exit', 'Find the shortest route from a grid cell to an exit.', 'Medium', array['Graph', 'Breadth-First Search']),
    (18, 'Schedule With Prerequisites', 'Find a valid task order subject to prerequisites.', 'Medium', array['Graph', 'Topological Sort']),
    (19, 'Median of Two Arrays', 'Find the median across two sorted arrays.', 'Hard', array['Array', 'Binary Search']),
    (20, 'Count Set Bits', 'Count the ones in the binary representation of an integer.', 'Easy', array['Bit Manipulation'])
) as problems(n, title, description, difficulty, tags)
on conflict (problem_number) do nothing;

-- The backend migration tree adds normalized tags. Populate them when present.
do $$
begin
    if to_regclass('public.problem_tags') is not null then
        insert into public.tags (tag_name)
        select distinct tag.name
        from public.problems p
        cross join lateral unnest(p.problem_tags) as tag(name)
        where p.problem_number between 900001 and 900020
        on conflict (tag_name) do nothing;

        insert into public.problem_tags (problem_number, tag_id)
        select p.problem_number, t.tag_id
        from public.problems p
        join public.tags t on t.tag_name = any(p.problem_tags)
        where p.problem_number between 900001 and 900020
        on conflict (problem_number, tag_id) do nothing;
    end if;
end;
$$;

insert into public.families (
    id, name, required_easy, required_medium, required_hard, reward_decription, punishment_decription
) values (
    'e2e00001-0000-4000-8000-000000000001', 'E2E Coding Family', 2, 1, 1,
    'Choose the next practice topic.', 'Review a missed problem together.'
)
on conflict (id) do nothing;

insert into public.user_families (user_id, family_id, completed_easy, completed_medium, completed_hard)
select user_id, 'e2e00001-0000-4000-8000-000000000001', 0, 0, 0
from e2e_seed_users
where user_number between 1 and 3
on conflict (user_id, family_id) do nothing;

insert into public.family_owners (family_id, user_id)
select 'e2e00001-0000-4000-8000-000000000001', user_id
from e2e_seed_users
where user_number = 1
on conflict (family_id) do nothing;

insert into public.posts (post_id, user_id, problem_number, post_description, created_at, updated_at)
select
    format('e2e00002-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid,
    u.user_id,
    900000 + n,
    format('Practice notes for %s.', p.problem_title),
    timestamp '2026-01-01 12:00:00' + n * interval '1 minute',
    timestamp '2026-01-01 12:00:00' + n * interval '1 minute'
from generate_series(1, 10) as posts(n)
join e2e_seed_users u on u.user_number = (n + 1) / 2
join public.problems p on p.problem_number = 900000 + n
on conflict (post_id) do nothing;

commit;

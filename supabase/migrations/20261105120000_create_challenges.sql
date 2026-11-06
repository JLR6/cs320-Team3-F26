-- Weekly challenges for families (backend/modules/challenges).
--
-- A challenge belongs to one family and lasts at most a week. It sets how many Easy /
-- Medium / Hard problems each member should solve, a reward and a punishment, and an
-- ordered list of specific problems (problem_order) to work through.
--
-- Who can do what (uses helpers from 20261029120000_family_endpoints.sql):
--   - family members can see their family's challenges
--   - the family owner and admins can create, edit and delete them
--
-- Custom error codes raised below (the backend maps these to HTTP status codes):
--   LMF08  a problem in problem_order isn't in public.problems   -> 400
--   LMF09  problem_order lists the same problem twice            -> 400
-- Postgres raises by itself:
--   23514  a CHECK rule failed (dates, counts, nulls in the list) -> 400
--   42501  RLS refused the change (not the owner or an admin)    -> 403

CREATE TABLE public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Deleting a family deletes its challenges too.
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,

    -- How many problems of each difficulty each member should solve this week.
    required_easy INT NOT NULL DEFAULT 0,
    required_medium INT NOT NULL DEFAULT 0,
    required_hard INT NOT NULL DEFAULT 0,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    punishment_description TEXT NOT NULL DEFAULT '',
    reward_description TEXT NOT NULL DEFAULT '',

    -- LeetCode problem numbers (public.problems.problem_number) in the order to solve them.
    -- Postgres can't put a foreign key on array elements, so the trigger below checks them.
    problem_order INT[] NOT NULL DEFAULT '{}',

    created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Weekly: ends on or after it starts, and lasts at most 7 days (Mon..Sun = 6 days apart).
    CONSTRAINT challenges_valid_dates CHECK (end_date >= start_date AND end_date - start_date <= 6),
    CONSTRAINT challenges_valid_required_counts CHECK (
        required_easy BETWEEN 0 AND 100 AND required_medium BETWEEN 0 AND 100 AND required_hard BETWEEN 0 AND 100
    ),
    CONSTRAINT challenges_problem_order_no_nulls CHECK (array_position(problem_order, NULL) IS NULL),
    CONSTRAINT challenges_problem_order_max_length CHECK (cardinality(problem_order) <= 50)
);

-- Listing a family's challenges newest first.
CREATE INDEX challenges_family_start_date_idx ON public.challenges (family_id, start_date DESC);

------------------------------------------------------------------------------------------
-- problem_order checks: every problem exists, and none is listed twice
------------------------------------------------------------------------------------------
-- Runs before every insert, and before updates that change problem_order.
-- Problems are publicly readable, so this can run as the logged-in user.
CREATE OR REPLACE FUNCTION public.check_challenge_problem_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_missing int;
BEGIN
    IF cardinality(NEW.problem_order) <> (SELECT count(DISTINCT p) FROM unnest(NEW.problem_order) AS p) THEN
        RAISE EXCEPTION 'problem_order lists the same problem more than once' USING ERRCODE = 'LMF09';
    END IF;

    SELECT p INTO v_missing
    FROM unnest(NEW.problem_order) AS p
    WHERE NOT EXISTS (SELECT 1 FROM public.problems WHERE problem_number = p)
    LIMIT 1;

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Problem % is not in the problems table', v_missing USING ERRCODE = 'LMF08';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER check_challenge_problem_order
    BEFORE INSERT OR UPDATE OF problem_order ON public.challenges
    FOR EACH ROW EXECUTE FUNCTION public.check_challenge_problem_order();

------------------------------------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------------------------------------
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can see challenges" ON public.challenges FOR SELECT
    USING (public.is_family_member(family_id));

-- created_by must be the person creating it, so nobody can create one "as" someone else.
CREATE POLICY "Owner and admins can create challenges" ON public.challenges FOR INSERT
    WITH CHECK (public.is_family_manager(family_id) AND created_by = auth.uid());

CREATE POLICY "Owner and admins can update challenges" ON public.challenges FOR UPDATE
    USING (public.is_family_manager(family_id))
    WITH CHECK (public.is_family_manager(family_id));

CREATE POLICY "Owner and admins can delete challenges" ON public.challenges FOR DELETE
    USING (public.is_family_manager(family_id));

-- A challenge can't be moved to another family, and its creator can't be changed.
REVOKE UPDATE ON public.challenges FROM authenticated;
GRANT UPDATE (
    required_easy, required_medium, required_hard, start_date, end_date,
    punishment_description, reward_description, problem_order, updated_at
) ON public.challenges TO authenticated;

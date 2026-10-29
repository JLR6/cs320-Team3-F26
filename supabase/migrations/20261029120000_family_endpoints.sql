-- Schema support for the /families endpoints (backend/modules/families).
--
-- 1. Families get a name (the Create Family design asks for one).
-- 2. create_family / delete_family / add_family_owner / remove_family_owner functions.
--    Each one does several writes that must succeed or fail together, and checks the
--    rules from the spec (5-family limit, owners only, keep at least one owner).
--    They are SECURITY DEFINER (run with the function owner's rights) so they can write
--    rows that RLS blocks for normal users, but every function first checks auth.uid()
--    (the logged-in user) itself, so users still can't do anything the rules forbid.
--    https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker
-- 3. Replace the "Owners can add new owners" policy, which had a bug (see section 3).
--
-- Custom error codes raised below (the backend maps these to HTTP status codes):
--   28000  not logged in                          -> 401
--   42501  logged in, but not an owner            -> 403
--   LMF01  user is already in 5 families          -> 409
--   LMF02  family not found (or not a member)     -> 404
--   LMF03  new owner is not a family member       -> 400
--   LMF04  that user is not an owner              -> 404
--   LMF05  can't remove the family's last owner   -> 409

------------------------------------------------------------------------------------------
-- 1. Family name
------------------------------------------------------------------------------------------
-- Existing rows (if any) get a placeholder so NOT NULL can be added; new rows must set it.
ALTER TABLE public.families ADD COLUMN name varchar(100) NOT NULL DEFAULT 'Untitled family';
ALTER TABLE public.families ALTER COLUMN name DROP DEFAULT;

------------------------------------------------------------------------------------------
-- 2a. Create a family: inserts the family, makes the creator its owner AND a member.
------------------------------------------------------------------------------------------
-- Why a function? There is no INSERT policy on families, and the old owner policy only let
-- existing owners add owners, so the first owner could never be added. Doing all three
-- inserts in one function also means we never end up with a family that has no owner.
CREATE OR REPLACE FUNCTION public.create_family(
    p_name varchar,
    p_required_easy int,
    p_required_medium int,
    p_required_hard int,
    p_reward_description text,
    p_punishment_description text
)
RETURNS public.families
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_family public.families;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'You must be logged in' USING ERRCODE = '28000';
    END IF;

    -- Serialize this user's create requests so two at once can't both pass the limit check.
    PERFORM pg_advisory_xact_lock(hashtext(v_user::text));

    -- Spec: users can belong to at most 5 families (owning one counts as belonging).
    IF (SELECT count(*) FROM public.user_families WHERE user_id = v_user) >= 5 THEN
        RAISE EXCEPTION 'You can belong to at most 5 families' USING ERRCODE = 'LMF01';
    END IF;

    -- Column names reward_decription / punishment_decription match the existing table.
    INSERT INTO public.families
        (name, required_easy, required_medium, required_hard, reward_decription, punishment_decription)
    VALUES
        (p_name, p_required_easy, p_required_medium, p_required_hard, p_reward_description, p_punishment_description)
    RETURNING * INTO v_family;

    INSERT INTO public.family_owners (family_id, user_id) VALUES (v_family.id, v_user);

    -- The creator is also a member, so they can see the family under the existing RLS rules.
    INSERT INTO public.user_families (user_id, family_id, completed_easy, completed_medium, completed_hard)
    VALUES (v_user, v_family.id, 0, 0, 0);

    RETURN v_family;
END;
$$;

------------------------------------------------------------------------------------------
-- 2b. Delete a family and everything that belongs to it. Any owner can do this.
------------------------------------------------------------------------------------------
-- There is no DELETE policy on families, and the family's members, owners, messages and
-- invites must be removed first because of foreign keys. One function = all or nothing.
CREATE OR REPLACE FUNCTION public.delete_family(p_family_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'You must be logged in' USING ERRCODE = '28000';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.family_owners WHERE family_id = p_family_id AND user_id = v_user) THEN
        -- Members learn they lack permission; non-members just see "not found", so we
        -- don't reveal that a private family exists.
        IF EXISTS (SELECT 1 FROM public.user_families WHERE family_id = p_family_id AND user_id = v_user) THEN
            RAISE EXCEPTION 'Only family owners can delete a family' USING ERRCODE = '42501';
        END IF;
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'LMF02';
    END IF;

    DELETE FROM public.family_messages WHERE family_id = p_family_id;
    DELETE FROM public.family_invites  WHERE family_id = p_family_id;
    DELETE FROM public.user_families   WHERE family_id = p_family_id;
    DELETE FROM public.family_owners   WHERE family_id = p_family_id;
    DELETE FROM public.families        WHERE id = p_family_id;
END;
$$;

------------------------------------------------------------------------------------------
-- 2c. Make an existing member an owner. Only owners can do this.
------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_family_owner(p_family_id uuid, p_user_id uuid)
RETURNS public.family_owners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_owner public.family_owners;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'You must be logged in' USING ERRCODE = '28000';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.family_owners WHERE family_id = p_family_id AND user_id = v_user) THEN
        IF EXISTS (SELECT 1 FROM public.user_families WHERE family_id = p_family_id AND user_id = v_user) THEN
            RAISE EXCEPTION 'Only family owners can add owners' USING ERRCODE = '42501';
        END IF;
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'LMF02';
    END IF;

    -- Owners must come from inside the family.
    IF NOT EXISTS (SELECT 1 FROM public.user_families WHERE family_id = p_family_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'The new owner must already be a member of the family' USING ERRCODE = 'LMF03';
    END IF;

    -- If they're already an owner, the primary key raises unique_violation (23505).
    INSERT INTO public.family_owners (family_id, user_id)
    VALUES (p_family_id, p_user_id)
    RETURNING * INTO v_owner;

    RETURN v_owner;
END;
$$;

------------------------------------------------------------------------------------------
-- 2d. Remove an owner (they stay a member). Owners can remove any owner, including
--     themselves (stepping down), but a family must always keep at least one owner.
------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_family_owner(p_family_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'You must be logged in' USING ERRCODE = '28000';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.family_owners WHERE family_id = p_family_id AND user_id = v_user) THEN
        IF EXISTS (SELECT 1 FROM public.user_families WHERE family_id = p_family_id AND user_id = v_user) THEN
            RAISE EXCEPTION 'Only family owners can remove owners' USING ERRCODE = '42501';
        END IF;
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'LMF02';
    END IF;

    -- Lock this family's owner rows so two owners removing each other at the same time
    -- can't leave the family with zero owners.
    PERFORM 1 FROM public.family_owners WHERE family_id = p_family_id FOR UPDATE;

    IF NOT EXISTS (SELECT 1 FROM public.family_owners WHERE family_id = p_family_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'That user is not an owner of this family' USING ERRCODE = 'LMF04';
    END IF;

    IF (SELECT count(*) FROM public.family_owners WHERE family_id = p_family_id) <= 1 THEN
        RAISE EXCEPTION 'A family must keep at least one owner. Make someone else an owner first, or delete the family.'
            USING ERRCODE = 'LMF05';
    END IF;

    DELETE FROM public.family_owners WHERE family_id = p_family_id AND user_id = p_user_id;
END;
$$;

-- Only logged-in users may call these (not anonymous visitors, not PUBLIC).
REVOKE ALL ON FUNCTION public.create_family(varchar, int, int, int, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_family(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_family_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_family_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_family(varchar, int, int, int, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_family(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_family_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_family_owner(uuid, uuid) TO authenticated;

------------------------------------------------------------------------------------------
-- 3. Remove the buggy "Owners can add new owners" policy
------------------------------------------------------------------------------------------
-- In 20261014145534_create_family_tables.sql the check was:
--     WHERE family_owners.family_id = public.family_owners.family_id
-- Inside the subquery both names refer to the SAME (inner) table, so the condition is
-- always true and the policy really meant "you own ANY family". That let an owner of one
-- family make themselves owner of every other family. Adding owners now goes through
-- add_family_owner() above, so direct inserts are no longer needed.
DROP POLICY IF EXISTS "Owners can add new owners" ON public.family_owners;

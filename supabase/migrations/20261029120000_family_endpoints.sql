-- Schema support for the /families endpoints (backend/modules/families).
--
-- Roles in a family:
--   owner   exactly one per family (public.family_owners). Can do everything an admin can,
--           plus: delete the family, make/remove admins, and hand ownership to another member.
--           The owner can't leave until they've transferred ownership; if they're the last
--           member, they delete the family instead.
--   admin   any number (public.family_admins, new). Can edit family details, manage invites,
--           remove regular members, and (later) set up weekly challenges.
--   member  everyone in public.user_families (the owner and admins are members too).
--
-- Multi-step changes go through SECURITY DEFINER functions: they run with the function
-- owner's rights so they can write rows RLS blocks for normal users, but each one checks
-- auth.uid() (the logged-in user) and the rules above first, and does all its writes in one
-- transaction.
-- https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker
--
-- Custom error codes raised below (the backend maps these to HTTP status codes):
--   28000  not logged in                                         -> 401
--   42501  logged in, but your role doesn't allow this           -> 403
--   LMF01  user is already in 5 families                         -> 409
--   LMF02  family not found (or you're not a member)             -> 404
--   LMF03  that user is not a member of this family              -> 404
--   LMF04  that user is not an admin of this family              -> 404
--   LMF05  not allowed on the owner (e.g. make the owner an admin) -> 400
--   LMF06  use leave (DELETE /user-families/:familyId) instead   -> 400

------------------------------------------------------------------------------------------
-- 1. Table changes
------------------------------------------------------------------------------------------
-- Families need a name (the Create Family design asks for one). Existing rows, if any,
-- get a placeholder so NOT NULL can be added; new rows must provide it.
ALTER TABLE public.families ADD COLUMN name varchar(100) NOT NULL DEFAULT 'Untitled family';
ALTER TABLE public.families ALTER COLUMN name DROP DEFAULT;

-- Exactly one owner per family: no two family_owners rows may share a family_id.
CREATE UNIQUE INDEX family_owners_one_owner_per_family ON public.family_owners (family_id);

CREATE TABLE public.family_admins (
    family_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (family_id) REFERENCES public.families(id),
    FOREIGN KEY (user_id) REFERENCES auth.users(id),
    PRIMARY KEY (family_id, user_id)
);
ALTER TABLE public.family_admins ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------------------------------
-- 2. Helper functions used by the policies and functions below
------------------------------------------------------------------------------------------
-- SECURITY DEFINER so policies can call them without RLS blocking the lookup (and without
-- a policy on one table recursively triggering itself). STABLE = read-only.
CREATE OR REPLACE FUNCTION public.is_family_owner(p_family_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.family_owners WHERE family_id = p_family_id AND user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_family_admin(p_family_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.family_admins WHERE family_id = p_family_id AND user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_family_member(p_family_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_families WHERE family_id = p_family_id AND user_id = p_user_id);
$$;

-- "Manager" = owner or admin: the people allowed to edit details, invites, members, challenges.
CREATE OR REPLACE FUNCTION public.is_family_manager(p_family_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT public.is_family_owner(p_family_id, p_user_id) OR public.is_family_admin(p_family_id, p_user_id);
$$;

-- Shared check at the start of each function: you must be logged in and in the family.
-- Non-members get "not found" so we don't reveal that a private family exists.
CREATE OR REPLACE FUNCTION public.require_family_member(p_family_id uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'You must be logged in' USING ERRCODE = '28000';
    END IF;
    IF NOT public.is_family_member(p_family_id, v_user) THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'LMF02';
    END IF;
    RETURN v_user;
END;
$$;

------------------------------------------------------------------------------------------
-- 3. Policy changes
------------------------------------------------------------------------------------------
-- Admins can now edit family details too (previously owners only).
DROP POLICY IF EXISTS "Family owners can update family details" ON public.families;
CREATE POLICY "Family owners and admins can update family details" ON public.families FOR UPDATE
    USING (public.is_family_manager(id))
    WITH CHECK (public.is_family_manager(id));

-- Admins can now manage invites too (previously owners only).
DROP POLICY IF EXISTS "Owners can manage their invites" ON public.family_invites;
CREATE POLICY "Owners and admins can manage invites" ON public.family_invites FOR ALL
    USING (public.is_family_manager(family_id))
    WITH CHECK (public.is_family_manager(family_id));

-- The owner can't leave until they've handed ownership to someone else.
DROP POLICY IF EXISTS "Users can leave families" ON public.user_families;
CREATE POLICY "Users can leave families (except the owner)" ON public.user_families FOR DELETE
    USING (user_id = auth.uid() AND NOT public.is_family_owner(family_id, user_id));

-- The old "Owners can add new owners" policy compared family_owners.family_id to itself
-- (inside its subquery both names meant the same table), so an owner of ANY family could add
-- owners to EVERY family. Ownership now only changes through transfer_family_ownership().
DROP POLICY IF EXISTS "Owners can add new owners" ON public.family_owners;

-- Members can see who the admins are. All changes go through the functions below.
CREATE POLICY "Family members can see admins" ON public.family_admins FOR SELECT
    USING (public.is_family_member(family_id));

-- When someone leaves or is removed, they stop being an admin too.
CREATE OR REPLACE FUNCTION public.remove_admin_on_leave()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    DELETE FROM public.family_admins WHERE family_id = OLD.family_id AND user_id = OLD.user_id;
    RETURN OLD;
END;
$$;

CREATE TRIGGER remove_admin_on_leave
    AFTER DELETE ON public.user_families
    FOR EACH ROW EXECUTE FUNCTION public.remove_admin_on_leave();

------------------------------------------------------------------------------------------
-- 4. Family functions called by the backend
------------------------------------------------------------------------------------------

-- Create a family. The creator becomes its owner and a member.
-- (There's no INSERT policy on families, so creation must go through here.)
CREATE OR REPLACE FUNCTION public.create_family(
    p_name varchar,
    p_required_easy int,
    p_required_medium int,
    p_required_hard int,
    p_reward_description text,
    p_punishment_description text
)
RETURNS public.families
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
    INSERT INTO public.user_families (user_id, family_id, completed_easy, completed_medium, completed_hard)
    VALUES (v_user, v_family.id, 0, 0, 0);

    RETURN v_family;
END;
$$;

-- Delete a family and everything in it. Owner only.
CREATE OR REPLACE FUNCTION public.delete_family(p_family_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user uuid := public.require_family_member(p_family_id);
BEGIN
    IF NOT public.is_family_owner(p_family_id, v_user) THEN
        RAISE EXCEPTION 'Only the family owner can delete the family' USING ERRCODE = '42501';
    END IF;

    -- Children first because of foreign keys.
    DELETE FROM public.family_messages WHERE family_id = p_family_id;
    DELETE FROM public.family_invites  WHERE family_id = p_family_id;
    DELETE FROM public.family_admins   WHERE family_id = p_family_id;
    DELETE FROM public.user_families   WHERE family_id = p_family_id;
    DELETE FROM public.family_owners   WHERE family_id = p_family_id;
    DELETE FROM public.families        WHERE id = p_family_id;
END;
$$;

-- Hand ownership to another member. Owner only. The old owner becomes a regular member
-- (not an admin); if the new owner was an admin, that admin row is removed.
CREATE OR REPLACE FUNCTION public.transfer_family_ownership(p_family_id uuid, p_new_owner_id uuid)
RETURNS public.family_owners
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user uuid := public.require_family_member(p_family_id);
    v_owner public.family_owners;
BEGIN
    IF NOT public.is_family_owner(p_family_id, v_user) THEN
        RAISE EXCEPTION 'Only the family owner can transfer ownership' USING ERRCODE = '42501';
    END IF;
    IF p_new_owner_id = v_user THEN
        RAISE EXCEPTION 'You are already the owner' USING ERRCODE = 'LMF05';
    END IF;
    IF NOT public.is_family_member(p_family_id, p_new_owner_id) THEN
        RAISE EXCEPTION 'That user is not a member of this family' USING ERRCODE = 'LMF03';
    END IF;

    DELETE FROM public.family_admins WHERE family_id = p_family_id AND user_id = p_new_owner_id;

    UPDATE public.family_owners
    SET user_id = p_new_owner_id, updated_at = CURRENT_TIMESTAMP
    WHERE family_id = p_family_id
    RETURNING * INTO v_owner;

    RETURN v_owner;
END;
$$;

-- Make a member an admin. Owner only.
CREATE OR REPLACE FUNCTION public.add_family_admin(p_family_id uuid, p_user_id uuid)
RETURNS public.family_admins
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user uuid := public.require_family_member(p_family_id);
    v_admin public.family_admins;
BEGIN
    IF NOT public.is_family_owner(p_family_id, v_user) THEN
        RAISE EXCEPTION 'Only the family owner can add admins' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_family_member(p_family_id, p_user_id) THEN
        RAISE EXCEPTION 'That user is not a member of this family' USING ERRCODE = 'LMF03';
    END IF;
    IF public.is_family_owner(p_family_id, p_user_id) THEN
        RAISE EXCEPTION 'The owner can''t also be an admin' USING ERRCODE = 'LMF05';
    END IF;

    -- If they're already an admin, the primary key raises unique_violation (23505).
    INSERT INTO public.family_admins (family_id, user_id)
    VALUES (p_family_id, p_user_id)
    RETURNING * INTO v_admin;

    RETURN v_admin;
END;
$$;

-- Turn an admin back into a regular member (they stay in the family). Owner only.
CREATE OR REPLACE FUNCTION public.remove_family_admin(p_family_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user uuid := public.require_family_member(p_family_id);
BEGIN
    IF NOT public.is_family_owner(p_family_id, v_user) THEN
        RAISE EXCEPTION 'Only the family owner can remove admins' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_family_admin(p_family_id, p_user_id) THEN
        RAISE EXCEPTION 'That user is not an admin of this family' USING ERRCODE = 'LMF04';
    END IF;

    DELETE FROM public.family_admins WHERE family_id = p_family_id AND user_id = p_user_id;
END;
$$;

-- Remove someone from the family. The owner can remove anyone except themselves; admins
-- can remove regular members only (not other admins, not the owner). To remove yourself,
-- use leave instead.
CREATE OR REPLACE FUNCTION public.remove_family_member(p_family_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user uuid := public.require_family_member(p_family_id);
BEGIN
    IF NOT public.is_family_manager(p_family_id, v_user) THEN
        RAISE EXCEPTION 'Only the owner or an admin can remove members' USING ERRCODE = '42501';
    END IF;
    IF p_user_id = v_user THEN
        RAISE EXCEPTION 'Use leave to remove yourself' USING ERRCODE = 'LMF06';
    END IF;
    IF NOT public.is_family_member(p_family_id, p_user_id) THEN
        RAISE EXCEPTION 'That user is not a member of this family' USING ERRCODE = 'LMF03';
    END IF;
    IF public.is_family_owner(p_family_id, p_user_id) THEN
        RAISE EXCEPTION 'The owner can''t be removed' USING ERRCODE = 'LMF05';
    END IF;
    IF public.is_family_admin(p_family_id, p_user_id) AND NOT public.is_family_owner(p_family_id, v_user) THEN
        RAISE EXCEPTION 'Only the owner can remove an admin' USING ERRCODE = '42501';
    END IF;

    -- The remove_admin_on_leave trigger also clears their admin row, if any.
    DELETE FROM public.user_families WHERE family_id = p_family_id AND user_id = p_user_id;
END;
$$;

------------------------------------------------------------------------------------------
-- 5. Who may call what
------------------------------------------------------------------------------------------
-- Only logged-in users may call the backend functions (not anonymous visitors).
REVOKE ALL ON FUNCTION public.create_family(varchar, int, int, int, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_family(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_family_ownership(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_family_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_family_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_family_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_family(varchar, int, int, int, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_family(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_family_ownership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_family_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_family_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_family_member(uuid, uuid) TO authenticated;

-- Helpers are used inside policies, which run as the logged-in user, so authenticated users
-- need EXECUTE on them. They only answer yes/no about roles. The trigger function is
-- internal and never called directly.
REVOKE ALL ON FUNCTION public.is_family_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_family_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_family_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_family_manager(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.require_family_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_admin_on_leave() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_manager(uuid, uuid) TO authenticated;

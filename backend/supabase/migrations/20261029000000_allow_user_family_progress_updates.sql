-- Keep membership keys immutable so UPDATE cannot bypass the invite-only INSERT policy.
REVOKE UPDATE ON public.user_families FROM authenticated;
GRANT UPDATE (completed_easy, completed_medium, completed_hard, updated_at)
    ON public.user_families TO authenticated;

CREATE POLICY "Users can update their family progress" ON public.user_families
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

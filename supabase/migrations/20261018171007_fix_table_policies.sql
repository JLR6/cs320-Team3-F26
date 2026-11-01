CREATE TABLE public.family_invites(
    invited_user_id UUID not null,
    family_id UUID not null,
    invite_status TEXT not null, -- "pending", "accepted", "rejected"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (invited_user_id, family_id)
);

ALTER TABLE public.family_invites
    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view which families they are members of" on public.user_families
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can leave families" on public.user_families
    FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can join families by valid invites" on public.user_families
    FOR INSERT WITH CHECK (user_id = auth.uid() AND family_id IN (SELECT family_id FROM public.family_invites WHERE invited_user_id = auth.uid() AND invite_status = 'pending'));

CREATE POLICY "Users can view their invites" on public.family_invites
    FOR SELECT USING (invited_user_id = auth.uid());

CREATE POLICY "Users can respond to their invites" on public.family_invites
    FOR UPDATE USING (invited_user_id = auth.uid())
    WITH CHECK (invited_user_id = auth.uid());

CREATE POLICY "Owners can manage their invites" on public.family_invites
    FOR ALL USING (family_id IN (SELECT family_id FROM public.family_owners WHERE user_id = auth.uid()))
    WITH CHECK (family_id IN (SELECT family_id FROM public.family_owners WHERE user_id = auth.uid()));

 -- Fix the follower table PK
 ALTER TABLE public.followers
    ADD PRIMARY KEY (follower_id, following_id);
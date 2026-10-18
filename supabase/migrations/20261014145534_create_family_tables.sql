CREATE TABLE public.families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    required_easy INT NOT NULL,
    required_medium INT NOT NULL,
    required_hard INT NOT NULL,
    punishment_decription TEXT NOT NULL,
    reward_decription TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.user_families (
    user_id UUID NOT NULL,
    family_id UUID NOT NULL,
    completed_easy INT NOT NULL,
    completed_medium INT NOT NULL,
    completed_hard INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES auth.users(id),
    FOREIGN KEY (family_id) REFERENCES public.families(id),
    PRIMARY KEY (user_id, family_id)
);

CREATE TABLE public.family_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL,
    user_id UUID NOT NULL,
    message_string TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (family_id) REFERENCES public.families(id),
    FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.family_owners (
    family_id UUID NOT NULL,
    user_id UUID NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (family_id) REFERENCES public.families(id),
    FOREIGN KEY (user_id) REFERENCES auth.users(id),
    PRIMARY KEY (family_id, user_id)
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can access their family" ON public.families FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_families
        WHERE user_families.family_id = public.families.id
        AND user_families.user_id = auth.uid()
    ));
CREATE POLICY "Family owners can update family details" ON public.families FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.family_owners
        WHERE family_owners.family_id = public.families.id
        AND family_owners.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.family_owners
        WHERE family_owners.family_id = public.families.id
        AND family_owners.user_id = auth.uid()
    ));

CREATE POLICY "Family members can see owners" ON public.family_owners FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_families
        WHERE user_families.family_id = public.family_owners.family_id
        AND user_families.user_id = auth.uid()
    ));
CREATE POLICY "Owners can add new owners" ON public.family_owners FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.family_owners
        WHERE family_owners.family_id = public.family_owners.family_id
        AND family_owners.user_id = auth.uid()
    ));

CREATE POLICY "Family members can see messages" ON public.family_messages FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_families
        WHERE user_families.family_id = public.family_messages.family_id
        AND user_families.user_id = auth.uid()
    ));
CREATE POLICY "Family members can post messages" ON public.family_messages FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.user_families
        WHERE user_families.family_id = public.family_messages.family_id
        AND user_families.user_id = auth.uid()
    ));

 -- PKs were not configured correctly on certain tables, adding them now
ALTER TABLE public.post_likes ADD PRIMARY KEY (user_id, post_id);
ALTER TABLE public.comment_likes ADD PRIMARY KEY (user_id, comment_id);
ALTER TABLE public.user_problems ADD PRIMARY KEY (user_id, problem_number);

-- For tracking problem completion status, was missing originally in the first migration
ALTER TABLE public.user_problems ADD COLUMN submission_state BOOLEAN DEFAULT FALSE;
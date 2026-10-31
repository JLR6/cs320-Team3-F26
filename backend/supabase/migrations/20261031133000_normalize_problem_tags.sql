-- store each tag once
CREATE TABLE public.tags (
    tag_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tag_name TEXT NOT NULL UNIQUE,
    CHECK (length(trim(tag_name)) > 0)
);

-- connect problems to their tags
CREATE TABLE public.problem_tags (
    problem_number INT NOT NULL,
    tag_id BIGINT NOT NULL,

    FOREIGN KEY (problem_number) REFERENCES public.problems(problem_number)
        ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES public.tags(tag_id)
        ON DELETE CASCADE,

    PRIMARY KEY (problem_number, tag_id)
);

-- make searching by tag faster
CREATE INDEX problem_tags_tag_id_idx
    ON public.problem_tags(tag_id);

-- allow users to view tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags" ON public.tags
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view problem tags" ON public.problem_tags
    FOR SELECT USING (true);

-- only the backend should change tags
GRANT SELECT ON public.tags, public.problem_tags TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.tags, public.problem_tags
    FROM anon, authenticated;

-- copy existing tags from the problems table
INSERT INTO public.tags (tag_name)
SELECT DISTINCT trim(t.name)
FROM public.problems p,
     unnest(p.problem_tags) AS t(name)
WHERE trim(t.name) <> ''
ON CONFLICT DO NOTHING;

-- connect the existing problems to their tags
INSERT INTO public.problem_tags (problem_number, tag_id)
SELECT DISTINCT p.problem_number, t.tag_id
FROM public.problems p,
     unnest(p.problem_tags) AS old_tag(name)
JOIN public.tags t ON t.tag_name = trim(old_tag.name)
ON CONFLICT DO NOTHING;

-- Keep the old problem_tags column for now.
-- Remove it after the backend uses the new tables.
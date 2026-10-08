CREATE TABLE public.users (
    user_id uuid PRIMARY KEY,
    username varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    profile_picture text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.problems (
    problem_number int PRIMARY KEY,
    problem_link text NOT NULL,
    problem_title varchar(255) NOT NULL,
    problem_description text,
    problem_difficulty text,
    problem_official_solution text,
    problem_tags text[],
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE public.posts (
    post_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    problem_number int NOT NULL,
    like_count int DEFAULT 0,
    post_description text,
    user_solution text,
    user_time_complexity text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES auth.users(id),
    FOREIGN KEY (problem_number) REFERENCES public.problems(problem_number)
);

CREATE TABLE public.post_likes (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp DEFAULT now(),

    FOREIGN KEY (post_id) REFERENCES public.posts(post_id),
    FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.user_problems (
    user_id uuid NOT NULL,
    problem_number int NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES auth.users(id),
    FOREIGN KEY (problem_number) REFERENCES public.problems(problem_number)
);

CREATE TABLE public.followers(
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp DEFAULT now(),

    FOREIGN KEY (follower_id) REFERENCES auth.users(id),
    FOREIGN KEY (following_id) REFERENCES auth.users(id)
);

CREATE TABLE public.post_comments(
    comment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    like_count int DEFAULT 0,
    comment_text text NOT NULL,
    created_at timestamp DEFAULT now(),
    modified_at timestamp DEFAULT now(),

    FOREIGN KEY (post_id) REFERENCES public.posts(post_id),
    FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.comment_likes(
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp DEFAULT now(),

    FOREIGN KEY (comment_id) REFERENCES public.post_comments(comment_id),
    FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE OR REPLACE FUNCTION update_cached_post_like_count()
RETURNS TRIGGER AS
$$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.posts
        SET like_count = (
            SELECT COUNT(*)
            FROM public.post_likes
            WHERE post_id = NEW.post_id
        )
        WHERE post_id = NEW.post_id;

    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.posts
        SET like_count = (
            SELECT COUNT(*)
            FROM public.post_likes
            WHERE post_id = OLD.post_id
        )
        WHERE post_id = OLD.post_id;
    END IF;
    RETURN NEW;
END;
$$
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_cached_comment_like_count()
RETURNS TRIGGER AS
$$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.post_comments
        SET like_count = (
            SELECT COUNT(*)
            FROM public.comment_likes
            WHERE comment_id = NEW.comment_id
        )
        WHERE comment_id = NEW.comment_id;

    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.post_comments
        SET like_count = (
            SELECT COUNT(*)
            FROM public.comment_likes
            WHERE comment_id = OLD.comment_id
        )
        WHERE comment_id = OLD.comment_id;
    END IF;
    RETURN NEW;
END;
$$
LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_cached_post_like_count
    AFTER INSERT OR UPDATE OR DELETE ON public.post_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_cached_post_like_count();

CREATE OR REPLACE TRIGGER update_cached_comment_like_count
    AFTER INSERT OR UPDATE OR DELETE ON public.comment_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_cached_comment_like_count();


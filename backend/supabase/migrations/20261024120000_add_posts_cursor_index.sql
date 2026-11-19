CREATE INDEX posts_feed_cursor_idx
    ON public.posts (created_at DESC NULLS LAST, post_id DESC);

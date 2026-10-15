create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now()
);

create index posts_created_at_id_idx on public.posts (created_at desc, id desc);
create index posts_user_id_idx on public.posts (user_id);

alter table public.posts enable row level security;

revoke all on public.posts from anon, authenticated;
grant select, delete on public.posts to authenticated;
grant insert (content), update (content) on public.posts to authenticated;

create policy "Authenticated users can read posts"
on public.posts for select to authenticated using (true);

create policy "Authors can create posts"
on public.posts for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Authors can update posts"
on public.posts for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Authors can delete posts"
on public.posts for delete to authenticated
using ((select auth.uid()) = user_id);

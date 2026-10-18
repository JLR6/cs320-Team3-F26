-- Run against disposable local Supabase as postgres with ON_ERROR_STOP=1.
begin;

insert into auth.users (id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.problems (problem_number, problem_link, problem_title)
values (-2147483648, 'https://example.test/problem', 'CRUD test fixture');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

do $$
declare
  own_id uuid;
  missing_problem integer;
begin
  insert into public.posts (user_id, problem_number, post_description)
    values (auth.uid(), -2147483648, 'Original') returning post_id into own_id;
  update public.posts set post_description = 'Updated', user_solution = null where post_id = own_id;
  if not exists (select 1 from public.posts where post_id = own_id and post_description = 'Updated') then
    raise exception 'Author update failed';
  end if;

  begin
    insert into public.posts (user_id, problem_number)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', -2147483648);
    raise exception 'Author spoofing was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.posts set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where post_id = own_id;
    raise exception 'Author reassignment was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.posts (user_id, problem_number) values (auth.uid(), null);
    raise exception 'Null problem reference was allowed';
  exception when not_null_violation then null;
  end;

  select n into missing_problem from generate_series(-2147483647, -2147483547) n
    where not exists (select 1 from public.problems where problem_number = n) limit 1;
  if missing_problem is null then raise exception 'No unused problem fixture number'; end if;
  begin
    insert into public.posts (user_id, problem_number) values (auth.uid(), missing_problem);
    raise exception 'Missing problem reference was allowed';
  exception when foreign_key_violation then null;
  end;

  insert into public.post_comments (post_id, user_id, comment_text)
    values (own_id, auth.uid(), 'Dependent comment');
  begin
    delete from public.posts where post_id = own_id;
    raise exception 'Deleting a post with a dependent comment was allowed';
  exception when foreign_key_violation then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

do $$
declare
  changed integer;
  own_id uuid;
begin
  if not exists (select 1 from public.posts where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'Signed-in user cannot read posts';
  end if;
  update public.posts set post_description = 'Unauthorized edit'
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Another author post was updated'; end if;
  delete from public.posts where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Another author post was deleted'; end if;
  insert into public.posts (user_id, problem_number) values (auth.uid(), -2147483648) returning post_id into own_id;
  delete from public.posts where post_id = own_id;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Author could not delete own post'; end if;
end $$;

reset role;
set local role anon;
do $$
begin
  if not exists (select 1 from public.posts where problem_number = -2147483648) then
    raise exception 'Public post read policy failed';
  end if;
  begin
    insert into public.posts (user_id, problem_number)
      values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', -2147483648);
    raise exception 'Anonymous write access was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;

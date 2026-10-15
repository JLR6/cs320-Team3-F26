-- Run against disposable local Supabase as postgres with ON_ERROR_STOP=1.
begin;

insert into auth.users (id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

do $$
declare
  post_id uuid;
  author uuid;
begin
  insert into public.posts (content) values ('Original') returning id, user_id into post_id, author;
  if author <> auth.uid() then raise exception 'Incorrect default author'; end if;
  update public.posts set content = 'Updated' where id = post_id;
  if not exists (select 1 from public.posts where id = post_id and content = 'Updated') then
    raise exception 'Author update failed';
  end if;

  begin
    insert into public.posts (content, user_id)
      values ('Spoofed', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'Author spoofing was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.posts set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = post_id;
    raise exception 'Author reassignment was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.posts (content) values ('   ');
    raise exception 'Blank content was allowed';
  exception when check_violation then null;
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

  update public.posts set content = 'Unauthorized edit'
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Another author post was updated'; end if;

  delete from public.posts where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Another author post was deleted'; end if;

  insert into public.posts (content) values ('My post') returning id into own_id;
  delete from public.posts where id = own_id;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Author could not delete own post'; end if;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.posts;
    raise exception 'Anonymous access was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;

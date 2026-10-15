# Posts API

All routes require `Authorization: Bearer <Supabase user access token>`.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/posts` | Up to 50 posts, newest first (200) |
| GET | `/posts/:id` | One post (200) |
| POST | `/posts` | Created post (201) |
| PATCH | `/posts/:id` | Updated post (200) |
| DELETE | `/posts/:id` | No response body (204) |

POST and PATCH accept only `{ "content": "Non-empty text" }`. Content is trimmed;
unknown fields, blank content, and invalid UUID route parameters return 400.
Post records contain `id`, `user_id`, `content`, and `created_at`.

Apply `backend/supabase/migrations/20261014000000_create_posts.sql` to a database
without an existing posts table before using these endpoints. For the local
environment, run `npx --no-install supabase migration up --local` from `backend`.
The migration creates the table, grants, and row-level policies. Signed-in users
can read posts; only their authors can update or delete them. The database assigns
the author from the access token. The API does not accept author IDs from clients.
Missing or inaccessible records return 404, including attempts to edit or delete
another author's post. Invalid/expired tokens return 401; denied database operations
return 403. Unexpected database failures return a generic 500 response.

Supply `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the backend process before startup.
These endpoints use user-scoped clients and require the database policies above.

Run HTTP and service tests from the repository root:

```sh
npm --prefix backend run test -- modules/posts
```

The HTTP tests mock the service; service tests mock HTTP responses from Supabase.
To verify database constraints and ownership policies against disposable local
Supabase, use its local postgres connection string:

```sh
psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f backend/supabase/tests/posts.sql
```

The SQL test creates two temporary users and rolls back its changes.

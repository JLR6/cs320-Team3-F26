# Posts API

All API routes currently require `Authorization: Bearer <Supabase user access token>`.
The database SELECT policy also permits public reads; the API retains its existing
requirement for a Bearer token.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/posts` | Up to 50 posts, newest first (200) |
| GET | `/posts/:id` | One post (200) |
| POST | `/posts` | Created post (201) |
| PATCH | `/posts/:id` | Updated post (200) |
| DELETE | `/posts/:id` | No response body (204) |

The route `:id` identifies the `post_id` column. Responses match the migrations:
`post_id`, `user_id`, `problem_number`, `like_count`, `post_description`,
`user_solution`, `user_time_complexity`, `created_at`, and `updated_at`.

POST requires an integer `problem_number` referencing an existing `public.problems`
row. Creating or fetching problem metadata is not implemented by this API; populate
that table through a trusted backend/admin process first. Optional text fields are
`post_description`, `user_solution`, and `user_time_complexity`; each accepts a
string or null. Formatting, including solution whitespace, is preserved.

Example POST body:

```json
{
  "problem_number": 1,
  "post_description": "Solved using a hash map",
  "user_solution": "return answer;",
  "user_time_complexity": "O(n)"
}
```

PATCH accepts any non-empty subset of those four fields, including null to clear
optional text. The backend refreshes `updated_at` on PATCH because the migrations
only give it a default value. POST verifies the token with Supabase Auth and sets
`user_id` to that user's ID; the column has no database default. Clients cannot set
`user_id`, `post_id`, `like_count`, or timestamps through these endpoints.

Apply the checked-in migrations from `backend` against local Supabase:

```sh
npx --no-install supabase migration up --local
```

The row-level policies allow only the author to update/delete a post. Missing or
inaccessible records return 404, including attempts to edit another author's post.
Invalid/expired tokens return 401; denied database operations return 403. Invalid
bodies, UUIDs, and nonexistent problem references return 400. A post with dependent
likes or comments cannot be deleted under the current foreign keys; DELETE returns
409 instead of cascading or silently removing related data. Other database errors
return a generic 500 response.

Supply `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the backend process before startup.
These endpoints use user-scoped clients and the checked-in database policies.

Run HTTP and service tests from the repository root:

```sh
npm --prefix backend run test -- modules/posts
```

HTTP tests use the application module with a mocked posts service. Service tests
mock Supabase HTTP responses, including Auth user verification. To verify database
constraints and policies against disposable local Supabase, supply its postgres
connection string:

```sh
psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f backend/supabase/tests/posts.sql
```

The SQL test creates temporary users and a problem fixture, then rolls back.

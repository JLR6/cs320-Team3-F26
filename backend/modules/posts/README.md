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

## Filtering posts by problem tags

`GET /posts` accepts an optional, repeated `tag` query parameter:

```http
GET /posts?tag=Array
GET /posts?tag=Array&tag=Hash%20Table
```

Multiple tags use **any-tag matching**: the second request returns posts whose
problem has `Array`, `Hash Table`, or both. Tags belong to the related
`public.problems.problem_tags` array, not the post itself. Filtered queries use an
inner join so posts with no matching problem tag are excluded.

Tag values are trimmed and duplicates removed. Matching is case-sensitive, so use
the stored capitalization. URL-encode spaces and other reserved characters; send
each tag separately rather than a comma-separated value. Missing tags leave the
list unfiltered; empty or whitespace-only values return 400, including an empty
value mixed with valid tags. Non-string values are also rejected. Authentication
is required for both filtered and unfiltered requests.

Both versions return up to 50 posts ordered by `created_at` descending, then
`post_id` descending. No matches return `[]`. Filtered results also include the
related problem's tags:

```json
{
  "post_id": "11111111-1111-4111-8111-111111111111",
  "problem_number": 1,
  "post_description": "Solved using a hash map",
  "problems": {
    "problem_tags": ["Array", "Hash Table"]
  }
}
```

This example omits other post fields for brevity. Unfiltered results retain the
original post-only shape without the nested `problems` object.

## Creating and updating posts

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
mock Supabase HTTP responses, including Auth user verification. For tag filtering,
service tests assert the inner join and array-overlap
operator (any selected tag), ordering, limit, and response shape. Controller tests
cover single/multiple tags, trimming, deduplication, invalid values, and required
authentication. These mocked tests do not execute the filter in a real database.
To verify database constraints and policies against disposable local Supabase,
supply its postgres
connection string:

```sh
psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f backend/supabase/tests/posts.sql
```

The SQL test creates temporary users and a problem fixture, then rolls back.

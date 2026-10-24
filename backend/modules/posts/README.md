# Posts API

All API routes currently require `Authorization: Bearer <Supabase user access token>`.
The database SELECT policy also permits public reads; the API retains its existing
requirement for a Bearer token.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/posts` | A cursor-paginated page of posts, newest first (200) |
| GET | `/posts/:id` | One post (200) |
| POST | `/posts` | Created post (201) |
| PATCH | `/posts/:id` | Updated post (200) |
| DELETE | `/posts/:id` | No response body (204) |

The route `:id` identifies the `post_id` column. Post records match the migrations:
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

Both versions return a page object containing up to 50 posts ordered by
`created_at` descending (nulls last), then `post_id` descending. No matches return
`{ "posts": [], "nextCursor": null, "hasMore": false }`. Filtered posts also include
the related problem's tags:

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

## Cursor pagination for infinite scrolling

**Response contract change:** `GET /posts` now returns
`{ posts, nextCursor, hasMore }` instead of a bare array. Consumers must read
`response.posts`. The other post endpoints keep their existing response shapes.

```http
GET /posts?limit=20&tag=Array
GET /posts?limit=20&tag=Array&cursor=<nextCursor from the previous response>
```

```json
{
  "posts": [{ "post_id": "11111111-1111-4111-8111-111111111111" }],
  "nextCursor": "<opaque continuation token>",
  "hasMore": true
}
```

The example abbreviates post fields and the cursor. `limit` defaults to 50 and
accepts integers from 1 through 50. Invalid limits or cursors return 400. Omit
`cursor` on the first request; send the returned token unchanged on the next
request. Use `URLSearchParams` to encode query parameters.

The cursor stores only the last returned post's exact `created_at` and `post_id`.
The **client stores previously returned posts** and appends each new batch. The
server remains stateless: it fetches rows older than the cursor, using the ID to
break timestamp ties. A cursor still works if its original post is deleted.
Timestamps retain PostgreSQL's microsecond precision, and posts with null
timestamps are paginated after dated posts. The query requests `limit + 1` rows
to detect another page, but returns only `limit` rows. The cursor refers to the
last returned row, so the extra row starts the next page. The final page has
`hasMore: false` and `nextCursor: null`, including when it contains exactly `limit`
posts.

Keep tags unchanged while following a cursor. When filters change, discard the
loaded posts and cursor and start a new first request. Newly created posts ahead
of the cursor appear when the feed is refreshed. This is a live feed, not a
database snapshot: deleting posts or changing their tags between requests can
change what appears on subsequent pages.

### Frontend usage example

The frontend currently has no feed page. This browser example shows how a future
feed can retain posts and request another batch when a bottom marker approaches
the viewport. `renderPosts` renders the accumulated array; `showError` can expose
a retry button wired to the returned `retry` function. `apiUrl` is the backend
base URL, served through your frontend's proxy or with suitable CORS configured.

```js
function observePosts({ apiUrl, accessToken, tags = [], sentinel, renderPosts, showError }) {
  let posts = [];
  let nextCursor = null;
  let hasMore = true;
  let loading = false;
  const controller = new AbortController();
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) void loadMore();
  }, { rootMargin: '300px' });

  async function loadMore() {
    if (loading || !hasMore || controller.signal.aborted) return;
    loading = true;
    observer.unobserve(sentinel);
    let succeeded = false;

    try {
      const url = new URL('/posts', apiUrl);
      url.searchParams.set('limit', '20');
      tags.forEach((tag) => url.searchParams.append('tag', tag));
      if (nextCursor) url.searchParams.set('cursor', nextCursor);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Unable to load posts (${response.status})`);
      const page = await response.json();
      if (controller.signal.aborted) return;

      // Keep earlier batches; IDs also protect against accidental duplicates.
      posts = [...new Map([...posts, ...page.posts].map((post) => [post.post_id, post])).values()];
      nextCursor = page.nextCursor;
      hasMore = page.hasMore;
      renderPosts(posts);
      succeeded = true;
    } catch (error) {
      if (!controller.signal.aborted) showError(error);
      // Retain the cursor and posts so an explicit retry fetches the same page.
    } finally {
      loading = false;
      if (succeeded && hasMore && !controller.signal.aborted) {
        // Reobserve so a still-visible marker can fill a tall viewport.
        observer.observe(sentinel);
      }
    }
  }

  void loadMore();
  return {
    retry: loadMore,
    destroy() {
      controller.abort();
      observer.disconnect();
    },
  };
}
```

Place `sentinel` after the post list and give it a height (for example, 1px).
Call `destroy()` on unmount or before changing tags, clear the rendered posts,
then call `observePosts` with the new tags. This aborts stale requests and resets
the accumulated posts and cursor. A request failure pauses automatic fetching
until `retry()` is called; reaching the final page stops observing the marker.

Apply the pagination index migration with the other checked-in migrations before
deploying. It indexes `(created_at DESC NULLS LAST, post_id DESC)` to support feed
ordering without offset pagination.

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
mock Supabase HTTP responses, including Auth user verification. Pagination tests
cover cursor encoding and validation, timestamp precision and nulls, page-size
bounds, lookahead rows, final pages, continuation queries with timestamp ties,
tag filtering, and error handling. HTTP tests verify query parsing, pagination
metadata, invalid input, and required authentication. These mocked tests verify
the generated Supabase requests and page handling; they do not execute filtering
or ordering in a real database.
To verify database constraints and policies against disposable local Supabase,
supply its postgres
connection string:

```sh
psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f backend/supabase/tests/posts.sql
```

The SQL test creates temporary users and a problem fixture, then rolls back.

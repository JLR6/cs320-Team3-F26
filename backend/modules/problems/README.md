# Problems API

Stores LeetCode problem info in `public.problems` so posts can reference it.

| Method | Route | Who | Result |
| --- | --- | --- | --- |
| GET | `/problems?difficulty=Easy&tag=Array` | anyone | Problems sorted by number (200) |
| GET | `/problems/:problemNumber` | anyone | One problem (200) |
| POST | `/problems` | admin key | Created problem (201) |
| PATCH | `/problems/:problemNumber` | admin key | Updated problem (200) |
| DELETE | `/problems/:problemNumber` | admin key | No body (204) |

Reads are public because the RLS policy is "Anyone can view problems" and guests can
see the feed. RLS blocks users from writing problems ("Problems should be populated by
the backend"), so writes use a service-role client (`SupabaseService.admin()`) and the
HTTP write routes require an `x-admin-key` header matching `ADMIN_API_KEY`.

Other modules should use `ProblemsService` directly. `findOrCreate(problem)` returns the
problem if it exists, or creates it, which is what `POST /posts` needs before inserting
a post. Import `ProblemsModule` into the other module to use it.

POST body (`problem_number`, `problem_link`, `problem_title` required):

```json
{
  "problem_number": 1,
  "problem_link": "https://leetcode.com/problems/two-sum/",
  "problem_title": "Two Sum",
  "problem_difficulty": "Easy",
  "problem_tags": ["Array", "Hash Table"]
}
```

PATCH accepts any non-empty subset of those fields except `problem_number`.
Optional fields accept null to clear them.

Errors: invalid body or filters 400, missing or wrong admin key 403, missing problem
404, duplicate number 409, deleting a problem that posts still reference 409, other
database errors 500 (details hidden).

Environment: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ADMIN_API_KEY`. Never commit the service-role key or expose it to the frontend.

Tests: `npm --prefix backend run test -- modules/problems`

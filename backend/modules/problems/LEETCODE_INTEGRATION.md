# Alfa LeetCode integration

`LeetCodeService` fetches from the community-hosted Alfa LeetCode API and converts
problem data into the existing `CreateProblemDto`. It does not write to Supabase.

- `GET /leetcode/problems?limit=5` previews a small problem list (no database changes).
- `GET /leetcode/problem/two-sum` previews a single problem by slug (no database changes).
- `POST /leetcode/import?limit=5` explicitly imports problems and requires `x-admin-key`.

## Automatic problem lookup during post creation

`POST /posts` still requires an authenticated user's Bearer token. Its existing
`problem_number` field is unchanged. It also accepts an optional `problem_slug`
when the referenced problem may not yet be stored in Supabase:

```json
{
  "problem_number": 1,
  "problem_slug": "two-sum",
  "post_description": "My solution"
}
```

Post creation first authenticates the user, then checks `ProblemsService.findOne()`.
If that number is missing, a slug is required. The backend fetches the selected
problem, verifies its actual number matches `problem_number`, and calls the
existing `ProblemsService.findOrCreate()` before inserting the post.

The slug is **not** a `posts` database column; it is stripped before insertion.
Existing clients may omit `problem_slug` for problems already in Supabase.

**Limitations:** Alfa's single-problem endpoint accepts a slug rather than a
numeric ID. The frontend must provide the slug when creating a post about a
new problem. The backend does not yet discover slugs from problem numbers.
If Alfa is unavailable and a problem isn't cached, post creation will fail.

Posts already in the database are unaffected. Editing a post to reference a
missing problem still uses the existing foreign-key validation behavior.

# Follows

Follow and unfollow users, and list who someone follows. Used by the profile page
(Follow / Following button and the Following tab).

All routes need `Authorization: Bearer <supabase access token>`. Requests use the
caller's token, so the `followers` RLS policies apply: you can only create or delete
follows where **you** are the follower.

| Method | Route | Description |
| --- | --- | --- |
| GET | `/users/:id/following` | Everyone that user follows, most recently followed first (200) |
| POST | `/users/:id/follow` | Follow that user as the logged-in user (201) |
| DELETE | `/users/:id/follow` | Stop following that user (204) |

`:id` must be a UUID (otherwise 400).

## Response

`GET /users/:id/following`:

```json
[
  {
    "user_id": "22222222-2222-4222-8222-222222222222",
    "username": "Elizabeth S.",
    "profile_picture": null,
    "last_posted_at": "2026-11-25T10:00:00"
  }
]
```

`last_posted_at` is `null` when they have never posted (the frontend shows "No posts").

`POST /users/:id/follow` returns the new row: `{ "follower_id": "...", "following_id": "..." }`.

## Errors

| Status | When |
| --- | --- |
| 400 | `:id` is not a UUID, or you try to follow yourself |
| 401 | Missing, malformed or expired token |
| 403 | The database refused the request |
| 404 | Following a user that doesn't exist, or unfollowing someone you don't follow |
| 409 | You already follow that user |
| 500 | Any other database error (details are hidden) |

## Notes

- Followers (who follows *you*) are intentionally not exposed: the spec says you can't
  see your followers.
- `followers` references `auth.users`, so profiles and last-post times are loaded with
  two extra queries by id instead of a PostgREST join.
- No migration is needed: the table, its primary key `(follower_id, following_id)` and
  its RLS policies already exist.

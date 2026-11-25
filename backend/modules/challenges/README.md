# Weekly Challenges API

Weekly challenges inside a family: how many Easy / Medium / Hard problems each member should
solve, an ordered list of specific problems, a reward and a punishment.

All routes require `Authorization: Bearer <Supabase access token>` and live under the
family the challenge belongs to.

| Method | Route | Who | Result |
| --- | --- | --- | --- |
| POST | `/families/:familyId/challenges` | owner, admins | New challenge (201) |
| GET | `/families/:familyId/challenges` | members | Challenges, newest first, up to 50 (200) |
| GET | `/families/:familyId/challenges/:challengeId` | members | One challenge (200) |
| PATCH | `/families/:familyId/challenges/:challengeId` | owner, admins | Updated challenge (200) |
| DELETE | `/families/:familyId/challenges/:challengeId` | owner, admins | Deletes it (204) |

## Request bodies

POST (every field is optional; see defaults below):

```json
{
  "required_easy": 3,
  "required_medium": 2,
  "required_hard": 1,
  "start_date": "2026-11-02",
  "end_date": "2026-11-08",
  "punishment_description": "Loser explains a Hard live",
  "reward_description": "Winner picks next week's problems",
  "problem_order": [1, 200, 15]
}
```

| Field | Rule | Default |
| --- | --- | --- |
| `required_easy`, `required_medium`, `required_hard` | integers 0–100 | 0 |
| `start_date`, `end_date` | real dates as `YYYY-MM-DD`; ends on or after it starts; at most 7 days long | today (UTC) → 6 days later |
| `punishment_description`, `reward_description` | up to 500 characters (trimmed) | `""` |
| `problem_order` | up to 50 LeetCode problem numbers, no repeats, in solving order; each must exist in `problems` | `[]` |

PATCH: any non-empty subset of the same fields. `problem_order` replaces the whole list
(`[]` clears it). Unknown fields, including `family_id`, are rejected with 400.

## Response

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "family_id": "11111111-1111-4111-8111-111111111111",
  "required_easy": 3,
  "required_medium": 2,
  "required_hard": 1,
  "start_date": "2026-11-02",
  "end_date": "2026-11-08",
  "punishment_description": "Loser explains a Hard live",
  "reward_description": "Winner picks next week's problems",
  "problem_order": [1, 200, 15],
  "created_by": "<user id>",
  "created_at": "2026-11-01T12:00:00",
  "updated_at": "2026-11-01T12:00:00"
}
```

## Errors

| Status | When |
| --- | --- |
| 400 | invalid body or UUID; bad dates/counts; a problem in `problem_order` isn't in `problems`, or is listed twice |
| 401 | missing/invalid token |
| 403 | a regular member tries to create, edit or delete |
| 404 | family or challenge not found, or you're not a member |
| 500 | other database errors (details hidden) |

## Database

Requires `supabase/migrations/20261105120000_create_challenges.sql` (repository root). It
depends on the families migration (`20261029120000_family_endpoints.sql`) for the
`is_family_member` / `is_family_manager` helpers. It adds:

- the `challenges` table, deleted automatically with its family;
- CHECK rules for dates (max 7 days), required counts (0–100) and `problem_order`;
- a trigger that rejects `problem_order` entries missing from `problems`, or repeated
  (Postgres can't put a foreign key on array elements);
- RLS: members can read; the owner and admins can create, update and delete;
- a column-level grant so `family_id` and `created_by` can't be changed after creation.

## Not covered yet

- Tracking each member's progress against a challenge, or a leaderboard.
- Rewards/punishments are text only; nothing is applied automatically.
- `problem_order` problems must already be in the `problems` table.

## Tests

`npm --prefix backend run test -- modules/challenges`

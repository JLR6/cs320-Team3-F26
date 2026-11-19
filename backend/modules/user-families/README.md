# User Families API

All routes require `Authorization: Bearer <Supabase user access token>` and operate
on the signed-in user's memberships in `public.user_families`.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/user-families` | Up to 50 memberships, newest first (200) |
| GET | `/user-families/:familyId` | One membership (200) |
| POST | `/user-families` | Created membership (201) |
| PATCH | `/user-families/:familyId` | Updated membership (200) |
| DELETE | `/user-families/:familyId` | Leave the family; no response body (204) |

The table has a composite primary key, `(user_id, family_id)`. The API derives
`user_id` from Supabase Auth, so `:familyId` identifies the current user's
membership. All queries use the user's client and filter by that user's ID;
row-level security remains in effect.

Responses contain `user_id`, `family_id`, `completed_easy`, `completed_medium`,
`completed_hard`, `created_at`, and `updated_at`.

POST requires a UUID `family_id` referencing an existing family. The database
requires a pending invite for the signed-in user to join that family. The three
completion counts are optional and default to zero in the API:

```json
{
  "family_id": "11111111-1111-4111-8111-111111111111",
  "completed_easy": 0,
  "completed_medium": 0,
  "completed_hard": 0
}
```

PATCH accepts a non-empty subset of `completed_easy`, `completed_medium`, and
`completed_hard`. Each count must be an integer from 0 to 2147483647. The backend
refreshes `updated_at` when updating progress. Clients cannot set `user_id`,
timestamps, or change a membership's `family_id`. Database UPDATE privileges also
restrict authenticated users to progress counts and `updated_at`, so direct
Supabase requests cannot move a membership to a family without an invite.

Errors: invalid body or family UUID 400, missing or invalid authentication 401,
RLS-denied operation (including joining without a pending invite) 403, missing or
inaccessible membership 404, duplicate membership or dependent records preventing
deletion 409, other database failures 500 (details hidden).

Apply the migrations under the repository-root `supabase/migrations` directory,
including the family-table, family-policy, and progress-update migrations. These
family migrations are not in the separate `backend/supabase` project. From the
repository root, against local Supabase:

```sh
backend/node_modules/.bin/supabase migration up --local
```

Environment: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

Tests: `npm --prefix backend run test -- modules/user-families`

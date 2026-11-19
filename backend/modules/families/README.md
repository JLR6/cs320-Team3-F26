# Families API

Create and manage families, transfer ownership, manage admins, and remove members.
Joining, leaving and progress counts are handled by `/user-families`.

All routes require `Authorization: Bearer <Supabase access token>`; families are private.

## Roles

| Role | How many | Can do |
| --- | --- | --- |
| **Owner** | exactly 1 | everything an admin can, plus delete the family, make/remove admins, transfer ownership |
| **Admin** | any number | edit family details, manage invites, remove regular members, (later) set up weekly challenges |
| **Member** | up to 20 | view the family, its owner and its admins; leave |

- Whoever creates a family becomes its owner (and a member).
- The owner **can't leave** until they transfer ownership to another member. After the
  transfer they're a regular member and can leave normally. If they're the last member,
  they delete the family instead.
- Only the owner makes or removes admins. Admins can't promote others.
- Admins can remove regular members, but not other admins or the owner. Only the owner can
  remove an admin from the family.
- Nobody removes themselves with the remove-member route; use leave (`DELETE /user-families/:familyId`).

## Endpoints

| Method | Route | Who | Result |
| --- | --- | --- | --- |
| POST | `/families` | any logged-in user | New family (201) |
| GET | `/families` | logged-in user | Families you belong to, newest first (200) |
| GET | `/families/:familyId` | members | One family (200) |
| PATCH | `/families/:familyId` | owner, admins | Updated family (200) |
| DELETE | `/families/:familyId` | owner | Deletes the family + its members, admins, owner, messages, invites (204) |
| GET | `/families/:familyId/owner` | members | The owner row (200) |
| PUT | `/families/:familyId/owner` | owner | Transfers ownership to another member; returns the new owner row (200) |
| GET | `/families/:familyId/admins` | members | List of admins, oldest first (200) |
| POST | `/families/:familyId/admins` | owner | Makes a member an admin (201) |
| DELETE | `/families/:familyId/admins/:userId` | owner | Makes an admin a regular member again (204) |
| DELETE | `/families/:familyId/members/:userId` | owner, admins | Removes someone from the family (204) |

## Request bodies

POST `/families`. Only `name` is required; the rest default to `0` / `""`:

```json
{
  "name": "Graph Grinders",
  "required_easy": 3,
  "required_medium": 2,
  "required_hard": 1,
  "reward_decription": "Winner picks next week's problems",
  "punishment_decription": "Loser explains a Hard live"
}
```

PATCH `/families/:familyId`: any non-empty subset of the same fields.

PUT `/families/:familyId/owner` and POST `/families/:familyId/admins`:
`{ "user_id": "<uuid of a family member>" }`

Field rules: `name` 1–100 characters (trimmed); `required_*` integers 0–1000;
reward/punishment text up to 500 characters. Unknown fields are rejected with 400.
Field names match the `families` table, including its spelling of `reward_decription`
and `punishment_decription`.

## Responses

A family:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Graph Grinders",
  "required_easy": 3,
  "required_medium": 2,
  "required_hard": 1,
  "reward_decription": "Winner picks next week's problems",
  "punishment_decription": "Loser explains a Hard live",
  "created_at": "2026-10-29T12:00:00",
  "updated_at": "2026-10-29T12:00:00"
}
```

Owner: `{ "family_id", "user_id", "created_at", "updated_at" }`.
Admin: `{ "family_id", "user_id", "created_at" }`.

## Errors

| Status | When |
| --- | --- |
| 400 | invalid body or UUID; action not allowed on the owner (make the owner an admin, remove the owner, transfer to yourself); removing yourself (use leave) |
| 401 | missing/invalid token |
| 403 | your role doesn't allow it (e.g. an admin deleting the family or removing another admin) |
| 404 | family not found or you're not a member; editing as a regular member; target user isn't a member / isn't an admin |
| 409 | already in 5 families; user is already an admin |
| 500 | other database errors (details hidden) |

## Database

Requires `supabase/migrations/20261029120000_family_endpoints.sql` (repository root, with
the other family migrations). It:

- adds `families.name` and a rule that each family has exactly one owner;
- adds the `family_admins` table (members can see it);
- adds functions `create_family`, `delete_family`, `transfer_family_ownership`,
  `add_family_admin`, `remove_family_admin` and `remove_family_member`, which check the
  role rules above and do each change in one transaction;
- lets admins (not just the owner) update family details and manage invites;
- stops the owner from leaving via `/user-families` until they've transferred ownership;
- removes someone's admin role automatically when they leave or are removed;
- removes the old "Owners can add new owners" policy. Its condition compared
  `family_owners.family_id` to itself, so an owner of any family could add owners to every
  family.

Apply from the repository root against local Supabase:

```sh
backend/node_modules/.bin/supabase migration up --local
```

## Not covered here

- The 20-member limit is checked when someone joins (`/user-families`).
- If the owner tries to leave without transferring, `/user-families` currently answers
  404 because the database blocks the delete. A clearer message there would help.
- Weekly-challenge permissions: when the challenges table is added, its policies can reuse
  `public.is_family_manager(family_id)` (owner or admin).
- Invite endpoints, the family feed and the group chat.

## Tests

`npm --prefix backend run test -- modules/families`

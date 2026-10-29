# Families API

Create, view, edit and delete families, and manage family owners.
Joining, leaving and progress counts are handled by `/user-families`.

All routes require `Authorization: Bearer <Supabase access token>`; families are private.

| Method | Route | Who | Result |
| --- | --- | --- | --- |
| POST | `/families` | any logged-in user | New family (201). You become its owner and a member. |
| GET | `/families` | logged-in user | Families you belong to, newest first (200) |
| GET | `/families/:familyId` | members | One family (200) |
| PATCH | `/families/:familyId` | owners | Updated family (200) |
| DELETE | `/families/:familyId` | owners | Deletes family + members, owners, messages, invites (204) |
| GET | `/families/:familyId/owners` | members | List of owners (200) |
| POST | `/families/:familyId/owners` | owners | Makes a member an owner (201) |
| DELETE | `/families/:familyId/owners/:userId` | owners | Removes an owner; they stay a member (204) |

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

POST `/families/:familyId/owners`: `{ "user_id": "<uuid of an existing member>" }`

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

An owner: `{ "family_id", "user_id", "created_at", "updated_at" }`.

## Rules

- **5-family limit:** creating a family fails if you already belong to 5 (owning counts).
- **Owners must be members:** only an existing member can be made an owner.
- **At least one owner:** you can't remove the last owner. Make someone else an owner
  first, or delete the family. Owners can remove themselves (step down) otherwise.
- **Any owner can delete the family.**
- **Privacy:** a family you're not in looks the same as one that doesn't exist (404).

## Errors

| Status | When |
| --- | --- |
| 400 | invalid body or UUID; new owner isn't a member |
| 401 | missing/invalid token |
| 403 | you're a member but not an owner (delete, add/remove owner) |
| 404 | family not found or you're not a member; editing as a non-owner; owner to remove not found |
| 409 | already in 5 families; user is already an owner; removing the last owner |
| 500 | other database errors (details hidden) |

## Database

Requires `supabase/migrations/20261029120000_family_endpoints.sql` (repository root,
with the other family migrations). It:

- adds `families.name`;
- adds `create_family`, `delete_family`, `add_family_owner` and `remove_family_owner`
  functions, which check the rules above and do each multi-step change in one transaction;
- removes the old "Owners can add new owners" policy. Its condition compared
  `family_owners.family_id` to itself, so an owner of any family could add owners to every
  family. Adding owners now goes through `add_family_owner`.

Apply from the repository root against local Supabase:

```sh
backend/node_modules/.bin/supabase migration up --local
```

## Not covered yet

- The 20-member limit is enforced when someone joins, which is in `/user-families`.
- "If everyone leaves, the family is disbanded" and "an owner must hand over ownership
  before leaving" happen on leave, also in `/user-families`.
- Invites and the family feed/chat.

## Tests

`npm --prefix backend run test -- modules/families`

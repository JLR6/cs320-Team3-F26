# User Problems API

All API routes currently require `Authorization: Bearer <Supabase user access token>`.
The database SELECT policy also permits public reads; the API retains its existing
requirement for a Bearer token.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/user-problem/:userId` | Returns all problems for a user |
| GET | `/user-problem/:userId/weekly` | Returns all problems for a user since the weekly reset |
| POST | `/user-problem/:userId/:problem_number` | Creates a new user_problems record |
| PATCH | `/user-problem/:userId` | Updates a user_problems record |
| DELETE | `/user-problem/:userId` | Deletes a user_problems record |

The weekly reset occurs every Sunday at 11:59pm, effectively resetting on monday.

The route `:userId` identifies the `user_id` column. 

POST, PATCH, and DELETE requires an integer `problem_number` referencing an existing `public.problems`
row as part of the primary key. 

POST and PATCH require a `submission_state` in the body, either a `"completed"` or a `"incomplete"` string.

Run HTTP and service tests from the repository root:

```sh
npm --prefix backend run test -- modules/user_problems
```

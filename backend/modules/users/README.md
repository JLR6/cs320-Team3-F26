# Users API

As of now any user can GET data for any user from the DB but only the information privileged to that user will be returned, tracked by their user access token. This is handled by the RLS policies on the DB. 

| Method | Route | Result |
| --- | --- | --- |
| GET | `/users/:id` | Query user data by ID |
| GET | `/users/username/:id` | Query user data by username |
| GET | `/users/:id/profilePicture` | Retrieves the signed URL to the PFP for user_id |
| POST | `/users` | Create a new user, requiring at least a username and email |
| PATCH | `/users/:id` | Updates a user |
| PATCH | `/users/:id/profilePicture` | Updates a users PFP in the supabase bucket, converting the image to a jpg first |
| DELETE | `/users/:id` | Deletes a user |

`:id` is the user_id column within the users table of the DB. `/users/:id` responses should contain data for the following columns, it is considered priviledged if only the user matching the ID has access to the data:

| Column | Privileged |
| --- | --- |
| user_id | FALSE |
| username | FALSE |
| email | TRUE |
| profile_picture | FALSE |

## Tests

Run the controller and service tests from the repository root:

```sh
npm --prefix backend run test -- modules/users
```
# Task Title : E2E Database Seed Data

## Main takeaways (You must write this section manually and without AI assistance. The purpose is for you to reflect on what you did and practice articulating that for others.)

* List of important takeaways

## Resource Usage

Tool and Model(s) Used: Codex (GPT-6)

Tokens Used & Dollar Equivalent (if using a free tier, specify how much of your allocation was used): Session totals were unavailable.

(Paste the full chat history from the session).

**User**

I want to create generic seed data I can use on E2E tests for our database. Can you please generate a SQL file/script that our E2E tests can execute to get test users, families, problems, and our other key entities. Please create the following entities:

- 5 users
- 20 problems
- 1 family (with one user as the owner and no admins)
- 10 posts (2 per user)

Please log this chat with the [ai_logs](./) folder using the same format as the [comments.md](./comments.md)

**Codex**

I’ll check the database schema, existing test setup, and chat-log format before writing the seed script.

**Codex**

The repository has two Supabase migration directories. The root project contains the family tables and roles, while the backend CI project references family tables it doesn’t create. I’ll make the seed runnable against the root project and document that prerequisite in the script.

**Codex**

The seed passed on a disposable Supabase instance. All five accounts signed in, family visibility matched the seeded roles, and a second run added no duplicate records.

**Codex**

Added [e2e.sql](../../supabase/seeds/e2e.sql) with **5 sign-in-ready users, 20 problems, 1 family, and 10 posts**. Each user has two posts. User 1 owns the family, users 2 and 3 are regular members, and users 4 and 5 are outside the family. The family starts with zero admins.

From the repository root, run this against a disposable local Supabase database initialized with the root migrations:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/supabase/seeds/e2e.sql
```

Use the local DB URL from `supabase status`. The test accounts are `e2e-user-1@example.test` through `e2e-user-5@example.test`, all with password `LocalE2ePassword123!`.

Verified the row counts, repeat execution, all five password sign-ins, and family visibility. The backend CI migration set is missing the family schema, so the script is currently run explicitly against the root project.

Saved the [chat log](./e2e-seed.md) with the manual takeaways section left for you.

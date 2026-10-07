# cs320-Team3-F26

A LeetCode inspired social media platform. Users can share completed problems, interact with other users, join families, and participate in weekly coding challenges.

## Project Structure

```text
cs320-Team3-F26/
├── backend/     # NestJS + Node.js + TypeScript + Supabase
├── frontend/    # Next.js + React + TypeScript
└── README.md
```

## Setup

Build and test tooling is configured for GitHub Actions. Application source is
minimal boilerplate for the frontend and backend developers to implement.

See [CI setup](docs/ci.md) for install/build commands, test suite conventions,
the disposable integration environment, and required GitHub checks. CI runs on
PRs and pushes to both `main` and `dev`, including merges into `dev`.

Application tests have not been implemented yet; empty suites intentionally fail.

## Tech Stack

### Frontend
- React (Next.js)
- React Hook Form
- Zod

### Backend
- TypeScript
- Node.js
- NestJS
- Supabase
- Vitest
- Supertest

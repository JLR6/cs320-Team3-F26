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

Bootstrap mode keeps builds and code-quality checks required while application
tests are being implemented. Coverage, integration, and E2E checks are temporarily
skipped; see [CI setup](docs/ci.md) to enable full test enforcement.

### Backend
Scoop is needed to install the Supabase CLI

Run the following for the Scoop and Supabase CLI Download inside Windows Powershell, as well as the Docker install

**Scoop**
```
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

**Supabase CLI**
```
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Docker**
```
winget install -e --id Docker.DockerDesktop
```


### Backend
Scoop is needed to install the Supabase CLI

Run the following for the Scoop and Supabase CLI Download inside Windows Powershell, as well as the Docker install

**Scoop**
```
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

**Supabase CLI**
```
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Docker**
```
winget install -e --id Docker.DockerDesktop
```


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

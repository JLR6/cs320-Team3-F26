# Task Title

Setup & Signup Page

## Main takeaways (You must write this section manually and without AI assistance. The purpose is for you to reflect on what you did and practice articulating that for others.)

- Learned the basic structure of Supabase authentication and the boilerplate it needs
  - it has changed a lot over the past few versions of Next.js so things aren't as up-to-date with their boilerplate
  - we need a client, proxy, server, and another proxy for exposure at the root.
- I learned how to use Zod to properly match schemas and such so that our site gives an error before sending a  pointless call to the backend that also will need fault-tolerance
- Also made it so that all of the login and signup follow a similar structure for forms and Zod schemas.
- There are a few doubts for the backend that I might need to confirm with that came up from my conversation with Claude when we checked the Supabase tables and what they had (and might be exposing).
- added a little bit of authentication stuff that will be used site-wide for functionality that requires authentication
  - uses the backend api for users and not directly the supabase since there is an api, we will use it since it is should be properly tested, while the supabase method might require more manual testing
- I learned a decent bit about Supabase and its tables and how auth can work with those tables which should help me communicate my concerns to the backend team

## Resource Usage

Tool and Model(s) Used: Claude Sonnet 5.5

Tokens Used & Dollar Equivalent (if using a free tier, specify how much of your allocation was used): Free Tier - estimated at most 80,000 tokens for usage limit every 5 hours (rolling)

## Chat Log

The first few steps were also a part of the setup.md conversation.
 
| # | I asked for | Outcome |
|---|---|---|
| 1 | A plan for the signup page, based on the requirements and the frontend research doc | 9-section plan: fields, file structure, Zod rules, UI behavior, frontend security, testing, order of work |
| 2 | A walkthrough of project setup | Next.js scaffold, Prettier, shadcn/ui init, theme tokens, shadcn components, library installs, `Providers`, smoke test |
| 3 | What to put in the starter `page.tsx` | A throwaway page using Card, Input, and Button to confirm the theme works |
| 4 | Fix: button not orange, page not dark | Cause: the `dark` class was missing on `<html>`. Fix: add `className="dark"` |
| 5 | Pasted my `globals.css` | Real cause: my `.dark` block came **before** `:root`, so `:root` overrode it. Fix: move `.dark` below `:root` and add the missing variables |
| 6 | Next steps | Route-group folders, Zod `signupSchema` |
| 7 | Next | `PasswordInput` (show/hide toggle) and the static signup page layout |
| 8 | Next | `SignupForm` (React Hook Form + Zod) |
| 9 | Pasted my Supabase files and asked what else was needed | Env vars, root `proxy.ts`, signup updates (username availability check, error mapping), placeholder `/dashboard`, sign-out button |
| 10 | Flow chart text for slides | Step-by-step signup flow with decision points |
| 11 | A setup guide for other machines | Clone, `pnpm install`, `.env.local`, run, verify, troubleshooting table |
| 12 | Auth integration guide and a Playwright auth test | Proxy upgrade, safe `next` helper, login contract, `useUser` hook, deployment and security checklists, full Playwright setup and test file |
| 13 | Pasted my login page | Review: unused import, unescaped apostrophe, helper location. Gave an async `searchParams` version |
| 14 | Full login integration, since email confirmation is off | `loginSchema`, shared `FieldError`, `LoginForm`, and a trimmed signup. Dropped the email-confirmation route |
| 15 | Is anything else from Part 1 needed? | Only the proxy upgrade is still required |
| 16 | What does "set Site URL and redirect URLs" mean? | Plain-language explanation. Low impact now, matters at deploy time |
| 17 | What does the profiles-table line mean, and is my `users` table good? | Explained the profile table, trigger, and username function. Listed fixes for my draft table |
| 18 | What changes on the frontend given the Users API? | API client, typed users module, TanStack Query usage, profile and settings UI |
 
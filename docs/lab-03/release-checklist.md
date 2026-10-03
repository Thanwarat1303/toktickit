# Lab 3 Release Integration Checklist

This checklist is evidence, not a substitute for the automated test output. Complete it
from the final `main` branch only, after all feature PRs are merged.

## Merge and migration

- [ ] `main` contains the approved Lab 3 feature PRs.
- [ ] `npx prisma migrate deploy` succeeds against a fresh database.
- [ ] `npm run prisma:seed` is idempotent; a second run creates no duplicate seed rows.
- [ ] The case-insensitive `User_email_lower_key` index exists after migration.

## Automated verification

- [ ] `npm test` in `server/` passes. Record total: `____ / ____`.
- [ ] `npm test` in `client/` passes. Record total: `____ / ____`.
- [ ] `npm run build` in `server/` passes.
- [ ] `npm run build` in `client/` passes.
- [ ] `npm test` in `e2e/` passes against restored E2E fixtures. Record total: `____ / ____`.

## Security and role checks

- [ ] Requester cannot access staff or admin endpoints/screens.
- [ ] IT Staff can use the shared queue and ticket workflow, but cannot manage users.
- [ ] Administrator can manage users but cannot bypass the last-active-admin rule.
- [ ] First-login accounts are forced through Change Password.
- [ ] State-changing requests use the session CSRF token and reject a missing/invalid token.

## UI and responsive review

- [ ] Desktop, tablet, and mobile screenshots are captured for Login, Change Password,
      IT Staff Queue, IT Staff Ticket Detail, and User Management.
- [ ] No screen clips, overlaps, or requires page-level horizontal scrolling.
- [ ] Ticket Detail header, Back button, and inner content retain visible card padding;
      they must not touch the card edge.
- [ ] Queue filters and selected option labels are readable at desktop and mobile widths.
- [ ] Keyboard focus and error feedback are visible for the reviewed controls.

## Submission evidence

- [ ] `docs/lab-03/tests.md` final statuses match the recorded final run.
- [ ] `docs/lab-03/reviewer.md` identifies the actual reviewer and approved PR links.
- [ ] `docs/lab-03/ai-use.md` accurately describes AI assistance and human verification.
- [ ] Screenshots, command output, and the required Answer Part 1–9 PDF are attached or linked.

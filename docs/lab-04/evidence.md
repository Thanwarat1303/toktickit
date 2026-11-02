# Lab 4 Evidence Index

This index links each submission area to evidence that exists in the repository or in the merged GitHub history. It separates confirmed evidence from work that remains planned, so the submission does not overstate coverage.

## Implementation and design

| Area | Evidence |
|---|---|
| Requirements, business rules and acceptance criteria | `specification.md` sections 3–9 |
| Request/response bodies and error behaviour | `api-spec.md` |
| Navigation, component states and responsive intent | `ui-spec.md` |
| Data model and additive migration | `server/prisma/schema.prisma`, `server/prisma/migrations/20261013090000_lab4_actions_taken/migration.sql` |
| Deterministic demo data | `server/prisma/seed-data.ts` |

## Automated evidence on `main`

The following were run sequentially against main commit `e211b14a44b54e45232cdbad9bb816785a5d9f7f` on 2026-11-02:

| Suite | Result | Scope |
|---|---:|---|
| Server Vitest | 22 files, 104/104 passed | API, migration, seed, workflow, dashboard and Lab 1–3 regression tests configured in this repository |
| Client Vitest | 10 files, 37/37 passed | Actions Taken, dashboards, filters, routes and existing screen regressions |
| Playwright | 6/6 passed | Authentication plus fresh-seed Administrator navigation at desktop/mobile widths |
| TypeScript/Vite builds | passed | server and client |
| Prisma migrate status | 8 migrations, up to date | local development database |

Detailed commands and the reseed note are in `release-checklist.md` section 8.

## Visual evidence

Committed screenshots are under `artifacts/lab-04/screenshots/`:

- Staff and Requester dashboards at desktop, tablet and phone widths.
- Ticket Queue and Staff Ticket Detail at desktop, tablet and phone widths.
- Actions Taken form at desktop, tablet and phone widths.
- Administrator Dashboard, Ticket Queue and User Management at 375px after the navigation-wrap fix.

The responsive-navigation Playwright regression measures `document.documentElement.scrollWidth <= window.innerWidth`; it does not infer no-overflow from image dimensions.

## Review evidence

`reviewer.md` lists the merged Lab 4 pull requests, the reviewer identity visible in GitHub, material findings and the resolving commits. The release merge is PR #78; the post-merge verification record is maintained separately so that the merge itself remains auditable.

## Honest coverage boundary

Some rows in `tests.md` remain **Planned** because this repository does not contain a dedicated test for the full stated scenario. They are intentionally not converted to Pass merely because another suite is green. The checklist in `release-checklist.md` preserves the same distinction.

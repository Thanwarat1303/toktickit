# Lab 3 Peer Review Record

Complete this record with facts after review. Do not list yourself as the independent reviewer. Reviewer identities, PR links, quoted comments, responses, and approvals must be copied from the actual GitHub review threads.

## Contract Review

| PR | Reviewer | Review result | Response / resolution |
|---|---|---|---|
| Pending | Pending | Pending | Contract review will be recorded before implementation PRs are completed. |

## Implementation Reviews

| Issue / PR | Reviewer | Review result | Response / resolution |
|---|---|---|---|
| Pending | Pending | Pending | To be filled from GitHub review history. |

## Release reviewer details

| Field | Record |
|---|---|
| Reviewer name / GitHub account | _Pending independent review_ |
| Review date | _Pending_ |
| Review scope | Security, migrations, API behavior, UI, tests, and E2E evidence |
| Final review decision | _Pending_ |

## Approved pull requests

| Feature | PR link | Reviewer decision |
|---|---|---|
| Authentication and session | _Add actual link_ | _Pending_ |
| Authorization and requester regression | _Add actual link_ | _Pending_ |
| IT Staff queue/detail/workflow | _Add actual link_ | _Pending_ |
| Public comments and internal notes | _Add actual link_ | _Pending_ |
| Administrator user management | _Add actual link_ | _Pending_ |
| Test/E2E and release integration | _Add actual link_ | _Pending_ |

## Review findings and resolutions

Record each material reviewer finding, the fixing commit/PR, and the verification result here.

### Material Lab 3 review history

The following is a concise record of the material findings discussed during implementation.
Before submission, replace the PR placeholders with the real GitHub links and confirm dates
and reviewer identity from those threads.

| Area | Reviewer finding | Resolution / evidence | PR link |
|---|---|---|---|
| Engineering contract | The confirmation-required dimension was missing from the ticket status transition contract. | Added the target-status confirmation matrix, BR-42, AC-31, API/UI contract details, and planned tests. | _Verify contract PR_ |
| Authentication migration | The authentication migration could duplicate schema objects when replayed from a fresh database. | Migration base and replay behavior were checked; auth migration was kept limited to its real schema diff. | _Verify authentication PR_ |
| Authentication security | Login timing differed for unknown/inactive emails because bcrypt comparison could be skipped. | Added a fixed dummy bcrypt hash so every login attempt performs one comparison. | Commit `862cf1f` |
| Authentication test isolation | Parallel test files leaked temporary user fixtures into seed-count assertions. | Server test files were configured to run serially while request-level race tests remain concurrent. | _Verify authentication PR_ |
| Requester regression | The App shell left Create Ticket, My Tickets, and Ticket Detail unreachable after login. | Requester workspace routes/components were wired back into `App.tsx`. | _Verify authorization PR_ |
| IT Staff queue | Unknown category/related-system filters were accepted, and mobile hid search with the collapsed filters. | Added reference validation and kept search visible above mobile secondary filters. | _Verify staff queue PR_ |
| IT Staff workflow | Claim used a read-then-write flow and could allow simultaneous conflicting claims. | Replaced it with atomic `updateMany` ownership claim and added concurrent-claim regression coverage. | Commit `e754e01` |
| Comments and notes | Posting a staff/Admin public comment to a missing ticket could cause an unhandled foreign-key failure. | Added an existence check and safe `404`; added comments/notes behavior and validation coverage. | _Verify comments/notes PR_ |
| Attachments | IT Staff could not download queue attachments because the route assumed every caller had a Requester profile. | Allowed IT Staff and retained Requester-only ownership checks; regression test added. | Commit `dcef836` |
| Administrator management | User-management endpoints initially lacked API regression coverage. | Added `users-admin.api.test.ts` for authorization, CRUD/reset, validation, duplicate email, and safety rules. | Commit `f5f8bf3` |
| Administrator safety test | Seed Administrators meant the “last active Administrator” test did not establish its required fixture state. | The test temporarily suspends non-fixture Administrators and restores exact prior states in `finally`. | Commit `ee30b0a` |
| UI polish | Requester Ticket Detail content could sit flush against the card edge. | Added responsive inner padding to the Ticket Detail card; final responsive review is required before release. | Commit `abb9f8b` |

### Final reviewer action

The independent reviewer should inspect this table against the GitHub history, add the real PR
links and their GitHub account, then record the final approval in the release reviewer details.

### Verified resolution dates

Use these dates when completing the corresponding GitHub review rows. They are taken from the
resolving commits, not guessed from chat history.

| Date | Resolved review items | Evidence |
|---|---|---|
| 2026-10-02 | Missing-ticket comment safety and full comments/notes API coverage | `1410ffd`, `fcf7841` |
| 2026-10-03 | IT Staff attachment download authorization, Ticket Detail padding, Administrator API coverage, and last-admin test isolation | `dcef836`, `abb9f8b`, `f5f8bf3`, `ee30b0a` |

## Review Checklist

- [ ] Reviewer identity and PR link are recorded.
- [ ] Each change request is quoted from the real review thread.
- [ ] The response and resulting commit are recorded.
- [ ] Approval or merge evidence is linked.
- [ ] Final `main` branch is checked before submission.

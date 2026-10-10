# Lab 4 Engineering Specification

## 1. Sprint goal

Extend TokTickIT with a traceable **Actions Taken** work log, safe ticket-resolution workflow, and concise dashboards for Requesters, IT Staff and Administrators. Preserve Labs 1-3 behaviour unless this contract explicitly changes it.

## 2. Scope

Included: Actions Taken data and UI; ticket transitions and resolution gate; role dashboards; optimistic concurrency; migration, seed, authorization, regression, accessibility and responsive evidence.

Excluded: SLA automation, notifications, inventory/cost accounting, approval workflows, exports, multi-tenancy and unapproved product features.

## 3. Functional requirements

- **FR-01** Staff and Administrators can list, create and edit Actions Taken on accessible tickets.
- **FR-02** An action stores action time, description, result, performer, optional assignee, follow-up fields, attachment notes and status.
- **FR-03** The performer comes from the session, never the request body.
- **FR-04** Requesters can read all approved action fields only for their own tickets; they cannot write actions.
- **FR-05** Final actions are never edited or deleted; cancellation is the non-destructive way to stop work.
- **FR-06** Every successful action create/edit preserves a readable immutable revision.
- **FR-07** Staff/Admin ticket status controls show only legal transitions and the API enforces the same matrix.
- **FR-08** Resolution requires an owner, at least one completed action, and no planned/in-progress actions.
- **FR-09** Requester “Problem appears resolved” remains advisory and does not change ticket status.
- **FR-10** Ticket writes and action edits detect stale versions without overwriting another user’s changes.
- **FR-11** Requester dashboard contains only the current Requester’s data.
- **FR-12** Staff dashboard shows unassigned, assigned-to-me, by-status, by-IT-priority, recently updated, open actions assigned to me and recent actions performed by me.
- **FR-13** Administrator dashboard includes Staff capabilities plus concise active/inactive user counts.
- **FR-14** Every metric has an accessible drill-down to the corresponding detailed view.
- **FR-15** Existing authentication, comments, notes, attachments and user management keep working.

## 4. Authorization

| Capability | Requester | IT Staff | Administrator |
|---|---:|---:|---:|
| Read own ticket/actions | yes | shared queue | shared queue |
| Create/edit action | no | yes | yes |
| View revisions | no | yes | yes |
| Claim/assign/priority/status/comment/note | no* | yes | yes |
| Requester appears-resolved | own ticket | no | no |
| Requester dashboard | own only | no | no |
| Staff dashboard | no | self metrics | self metrics + user counts |
| User management | no | no | yes |

\* Requesters may still post public comments on their own tickets as in Lab 3.

## 5. Business rules

- **BR-01** An Action Taken belongs to exactly one Ticket; one Ticket has many actions.
- **BR-02** `performedById` is server-derived from the authenticated Staff/Admin session.
- **BR-03** `description` is required, trimmed and at most 2,000 characters.
- **BR-04** `followUpNote` is required when `followUpRequired` is true; otherwise it is stored empty.
- **BR-05** `actionAt` defaults to now, may be past, and cannot be more than five minutes in the future.
- **BR-06** Create allows PLANNED, IN_PROGRESS or COMPLETED; edit allows PLANNED -> IN_PROGRESS/COMPLETED/CANCELLED and IN_PROGRESS -> COMPLETED/CANCELLED. COMPLETED/CANCELLED are final. COMPLETED needs a result.
- **BR-07** An action assignee must be an active IT Staff or Administrator.
- **BR-08** Actions are append-only: no delete endpoint. Current values live on `ActionTaken`; creation writes revision 1 and each successful edit appends an immutable `ActionTakenRevision` in the same transaction.
- **BR-09** Actions are ordered by `actionAt`, then `id`, ascending.
- **BR-10** CLOSED/CANCELLED tickets accept no actions. A RESOLVED ticket accepts no new PLANNED/IN_PROGRESS action; it must be reopened first. A completed action may be recorded only if the status workflow permits it.
- **BR-11** The Lab 3 ticket matrix remains, with IT Staff and Administrator authorized for ticket operations.
- **BR-12** RESOLVED requires an owner, a COMPLETED action and no PLANNED/IN_PROGRESS action.
- **BR-13** Each action create/edit and ticket status write locks the Ticket first in one transaction. The gate check and status update occur while locked.
- **BR-14** Confirmation remains required for RESOLVED, CLOSED, REOPENED and CANCELLED; error order is 401, 403, 400, 404, 409.
- **BR-15** `Ticket.version` and `ActionTaken.version` start at 1. Ticket claim/assign/priority/status/mark-resolved and action edit require the loaded version; stale writes return `409 STALE_VERSION`. The former Lab 3 `PATCH /api/staff/tickets/:id/workflow` route is retained only for `itPriority`; it rejects `status` and `confirm`. Status changes have exactly one write route: `PATCH /api/staff/tickets/:id/status`.
- **BR-16** Comments and notes append rows and neither require nor bump `Ticket.version`.
- **BR-17** Dashboard data is calculated on the server. “Open” is NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER or REOPENED.
- **BR-18** “Recently” is the last seven calendar days in Asia/Bangkok; timestamps remain UTC.
- **BR-19** Dashboard empty counts are `0` and lists are `[]`, never omitted/null.
- **BR-20** “Open actions assigned to me” counts distinct open tickets with the caller as action assignee and a PLANNED/IN_PROGRESS action. “My recent actions” uses performer, not assignee.
- **BR-21** Migration is additive; all Lab 1-3 rows remain valid and existing ticket versions start at 1.

## 6. Data model and migration

`ActionTaken`: id, ticketId, performedById, optional assigneeId, status, actionAt, description, result, followUpRequired, followUpNote, attachmentNotes, version, createdAt, updatedAt. Index `(ticketId, actionAt, id)` and `(assigneeId, status)`.

`ActionTakenRevision`: id, actionTakenId, revision, editedById, editedAt and a snapshot of action status, assignee, time and editable text fields. Unique `(actionTakenId, revision)`; no application update/delete route.

`Ticket` gains non-null `version Int @default(1)`. Migration is additive. Rollback before production data: restore the pre-migration dump or remove the new tables, enum and column in reverse dependency order.

Seed data is idempotent and demonstrates all ticket statuses/priorities, owned/unowned tickets, 0/1/many actions, gate pass/fail and zero/non-zero dashboard cases.

## 7. Ticket workflow

The existing eight statuses remain: NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED and CANCELLED. The API returns `allowedTransitions` and `resolutionGate`; the UI only offers those transitions. A stale ticket write is rejected with the current version. The backend—not the client—enforces transitions and BR-12. `PATCH /api/staff/tickets/:id/status` is the only status-transition endpoint. The retained Lab 3 `/workflow` route handles `itPriority` alone and cannot change status.

## 8. Acceptance criteria

- **AC-01** Valid Staff/Admin action create returns 201, server performer and version 1.
- **AC-02** Requester action writes return 403 and write nothing.
- **AC-03** Invalid description/follow-up/result/assignee/date returns field-level 400.
- **AC-04** Lists are stable; Requester ownership is 200/404 and read-only.
- **AC-05** Current action edit succeeds and increments version; stale edit is 409 without change.
- **AC-06** Final action edit/delete is rejected and no revision is added.
- **AC-07** Revision history returns every snapshot oldest-first; rejected edits are atomic.
- **AC-08** Every permitted ticket transition succeeds; forbidden ones return 409.
- **AC-09** Each missing resolution prerequisite returns 409 with its unmet reason.
- **AC-10** Concurrent RESOLVED/action operations leave no RESOLVED ticket with an open action.
- **AC-11** Direct creation of an open action on RESOLVED is rejected until the ticket is reopened.
- **AC-12** Missing/stale ticket versions return 400/409 and cannot overwrite changes.
- **AC-13** Dashboard counts and drill-down sets equal database queries for the caller’s role.
- **AC-14** Administrator receives Staff ticket behaviour; Requester remains forbidden.
- **AC-15** New screens have loading, empty, forbidden, validation, conflict and safe-error states.
- **AC-16** Keyboard, contrast, labels, desktop/tablet/mobile and no-overflow checks pass.
- **AC-17** All Lab 1-3 regression suites pass after migration.

## 9. Definition of done

- [ ] Contract reviewed before implementation PRs.
- [ ] Migration/seed/API/UI/unit/API/authorization/E2E tests implemented and passing.
- [ ] Full prior regression runs on staging and main.
- [ ] Responsive screenshots and completed visual/accessibility checklist.
- [ ] `reviewer.md` records real reviewers, PR links, comments, fixes and approvals.
- [ ] README, AI-use reflection, GitHub board and final evidence are complete.

## 10. Decisions

Administrator has the handout’s IT Staff behaviour plus user administration. Revisions are readable only by Staff/Admin because Requester action visibility is read-only current work information. New open work after resolution requires reopening first, so the resolution gate remains true beyond a single race window.

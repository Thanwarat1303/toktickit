# Lab 4 Test Plan and Traceability

All rows are **Planned** until implementation evidence is recorded.

| ID | Area | Expected result | Status |
|---|---|---|---|
| API-01..04 | action create/list/ownership/validation | server author, stable order, safe 400/401/403/404 | Pass (F3) |
| API-05..08 | action create edge cases | assignee/date/status/ticket-state validation | Planned |
| API-09..15 | action edit/final/delete/version | no lost update, no delete, final action protected | Pass (F4) |
| API-16 | resolved/closed action policy | direct open-action create on RESOLVED/CLOSED/CANCELLED is rejected | Pass (F4) |
| API-17..20 | status matrix and resolution gate | legal transitions only; gate reasons correct | Planned |
| API-21 | concurrent action vs resolve | 20 rounds; no RESOLVED ticket ends with open action | Planned |
| API-22 | ticket versioning and route separation | claim/assign/priority/status/mark-resolved stale/missing/current cases; legacy `/workflow` changes priority only and rejects status/confirm | Planned |
| API-23 | revisions | revision 1 plus each edit; atomic failure leaves projection/history unchanged | Planned |
| API-24 | authorization matrix | no session, wrong role, forged origin, ownership concealment | Planned |
| API-25..28 | dashboards | values and drill-down sets equal raw database queries | Planned |
| MIG-01..03 | migration and seed | additive migration, version defaults, revision constraints and idempotent seed | Pass (F2) |
| UI-01..06 | Actions Taken | list/form/errors/conflict/history/read-only/final states | Planned |
| UI-07..10 | workflow | legal buttons, gate reasons, confirmation, version sent | Planned |
| UI-11..14 | dashboards | role navigation, cards, drill-down, loading/empty/error/forbidden | Planned |
| SEC-01..03 | security | route-role sweep, 401/403/404 ladder, CSRF | Planned |
| A11Y-01..04 | accessibility | keyboard, focus, contrast, text cues | Planned |
| RSP-01..02 | responsive | dashboard/detail at 375/768/1280 without overflow | Planned |
| E2E-01..04 | end-to-end | actions lifecycle, resolution, dashboards, Administrator parity | Planned |
| REG-01 | regression | Labs 1-3 server/client/Playwright suites pass | Planned |

## Traceability

| Requirement | Tests |
|---|---|
| FR-01..06, BR-01..10 | API-01..16, API-23, UI-01..06, E2E-01 |
| FR-07..10, BR-11..16 | API-17..22, UI-07..10, E2E-02 |
| FR-11..14, BR-17..20 | API-25..28, UI-11..14, E2E-03 |
| FR-15, BR-21 | MIG-01..03, SEC-01..03, A11Y-01..04, RSP-01..02, REG-01 |

## Lab 3 regression changes expected

Staff ticket-detail tests will provide ticket version and satisfy the resolution gate before resolving. The existing `/workflow` tests are changed to send only `itPriority`; status assertions move to `/status`, and attempts to send `status`/`confirm` through `/workflow` assert `400`. Administrator ticket operations now succeed where Lab 3 expected 403. Client tests assert version in ticket-write bodies. Existing comments/notes remain unversioned. Every altered Lab 3 expectation is updated in the same feature PR that changes the behaviour.

## F2 evidence: Actions Taken schema, migration and seed

- `server/tests/lab-04/migration.api.test.ts` replays the real Lab 1-3
  migrations in a scratch schema, applies the Lab 4 SQL, and checks that the
  existing ticket remains unchanged except for `version = 1`, required indexes
  and defaults exist, and duplicate revision numbers are rejected.
- `server/tests/lab-04/actions-taken-data.test.ts` verifies seed idempotency,
  status/priority coverage, zero/one/many action fixtures, the resolved/closed
  invariant, revision 1 snapshots, and zero/non-zero dashboard fixtures.
- The migration is additive. It adds `ActionStatus`, `ActionTaken`,
  `ActionTakenRevision` and `Ticket.version` only. The migration file documents
  manual rollback in reverse dependency order; production rollback restores the
  pre-migration database backup rather than dropping populated Action Taken data.

## F3 evidence: Actions Taken create/list API and authorization

- `server/tests/lab-04/actions-taken.api.test.ts` verifies Staff/Admin creates,
  a server-derived performer, revision 1, Requester ownership concealment,
  stable `actionAt`/`id` ordering, 401/403 write denial, and field-level 400
  validation without a partial write.

## F4 evidence: Action Taken editing, revision history and validation

- `server/tests/lab-04/actions-taken.api.test.ts`: 10 tests pass. It covers a successful versioned edit,
  immutable revisions in oldest-first order, stale versions, invalid status moves, merged
  completed/follow-up validation, final-action protection, no delete route, revision-history
  authorization, and the RESOLVED open-action restriction.

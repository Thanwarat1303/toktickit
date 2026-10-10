# Lab 4 Test Plan and Traceability

All rows are **Planned** until implementation evidence is recorded.

| ID | Area | Expected result | Status |
|---|---|---|---|
| API-01..08 | action create/list/ownership/validation | server author, stable order, safe 400/403/404 | Planned |
| API-09..15 | action edit/final/delete/version | no lost update, no delete, final action protected | Planned |
| API-16 | resolved/closed action policy | direct open-action create on RESOLVED/CLOSED/CANCELLED is rejected | Planned |
| API-17..20 | status matrix and resolution gate | legal transitions only; gate reasons correct | Planned |
| API-21 | concurrent action vs resolve | 20 rounds; no RESOLVED ticket ends with open action | Planned |
| API-22 | ticket versioning and route separation | claim/assign/priority/status/mark-resolved stale/missing/current cases; legacy `/workflow` changes priority only and rejects status/confirm | Planned |
| API-23 | revisions | revision 1 plus each edit; atomic failure leaves projection/history unchanged | Planned |
| API-24 | authorization matrix | no session, wrong role, forged origin, ownership concealment | Planned |
| API-25..28 | dashboards | values and drill-down sets equal raw database queries | Planned |
| MIG-01..03 | migration and seed | additive migration, rollback plan, idempotent seed | Planned |
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

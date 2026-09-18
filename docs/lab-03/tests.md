# Lab 3 Test Plan and Traceability

Tests are planned before implementation and must be marked `Pass` only after they run successfully from the final `main` branch.

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-01 | API Positive | FR-01 / AC-01 | Valid active login | 200, safe user, session cookie | server/tests/lab-03/auth.api.test.ts | Planned |
| API-02 | API Negative | BR-01 | Invalid credentials | 401 safe error | server/tests/lab-03/auth.api.test.ts | Planned |
| API-03 | API Negative | BR-13 | Inactive account login | 401 safe error | server/tests/lab-03/auth.api.test.ts | Planned |
| API-04 | API Positive | FR-03 / AC-03 | Current user and logout | Identity returned; logout invalidates session | server/tests/lab-03/auth.api.test.ts | Planned |
| API-05 | API Positive | FR-02 / AC-02 | First-login password change | Normal access only after valid change | server/tests/lab-03/auth.api.test.ts | Planned |
| API-06 | API Security | BR-03 / AC-04 | Requester ownership | Client requester ID cannot cross scope | server/tests/lab-03/authorization.api.test.ts | Planned |
| API-07 | API Security | FR-04 | Role guards | Unauthenticated/forbidden roles rejected | server/tests/lab-03/authorization.api.test.ts | Planned |
| API-08 | Migration | FR-09 / AC-11 | Lab 2 migration | Existing tickets/attachments retain owners | server/tests/lab-03/migration.api.test.ts | Planned |
| API-09 | API Positive | FR-06 / AC-05 | Staff queue queries | Search, filters, sort, pagination and metadata | server/tests/lab-03/staff-queue.api.test.ts | Planned |
| API-10 | API Security | FR-06 | Queue authorization | Requester cannot access staff queue | server/tests/lab-03/staff-queue.api.test.ts | Planned |
| API-11 | API Positive | FR-06 / AC-06 | Claim and reassign | Valid active staff ownership changes | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned |
| API-12 | API Negative | BR-09 / BR-12 | Invalid owner/status | Safe conflict or validation response | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned |
| API-13 | API Positive | BR-10 | IT Priority update | Staff can update IT Priority only | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned |
| API-14 | API Positive | AC-08 | Public Comment | Appended with author/time and readable to permitted roles | server/tests/lab-03/comments-notes.api.test.ts | Planned |
| API-15 | API Security | BR-06 / AC-07 | Internal Note visibility | Requester gets 403 and no note content | server/tests/lab-03/comments-notes.api.test.ts | Planned |
| API-16 | API Negative | BR-07 | Empty/over-limit comment | 400 and no row written | server/tests/lab-03/comments-notes.api.test.ts | Planned |
| API-17 | API Positive | FR-08 / AC-09 | Admin user list/search | Safe list and optional role filter | server/tests/lab-03/users-admin.api.test.ts | Planned |
| API-18 | API Positive | FR-08 | Create/edit user | Valid one-role account created/updated | server/tests/lab-03/users-admin.api.test.ts | Planned |
| API-19 | API Negative | BR-14 | Duplicate email | 409 and no duplicate row | server/tests/lab-03/users-admin.api.test.ts | Planned |
| API-20 | API Security | BR-15 / BR-16 | Admin safety | Self-deactivation/last-admin protection | server/tests/lab-03/users-admin.api.test.ts | Planned |
| UI-01 | UI | FR-01 | Login validation/busy/error | Clear feedback and disabled submit | client/tests/lab-03/Login.test.tsx | Planned |
| UI-02 | UI | FR-02 | Mandatory password change | Cannot bypass; successful continuation | client/tests/lab-03/ChangePassword.test.tsx | Planned |
| UI-03 | UI | FR-04 | Role navigation | Only permitted destinations shown | client/tests/lab-03/AppShell.test.tsx | Planned |
| UI-04 | UI | FR-06 / AC-05 | Staff queue interactions | Query controls, badges, empty/no-results states | client/tests/lab-03/StaffTicketQueue.test.tsx | Planned |
| UI-05 | UI | FR-06 / AC-06 | Staff detail operations | Claim, assign, priority, status and feedback | client/tests/lab-03/StaffTicketDetail.test.tsx | Planned |
| UI-06 | UI | FR-07 / AC-07 | Comments vs notes | Distinct controls and visibility | client/tests/lab-03/StaffTicketDetail.test.tsx | Planned |
| UI-07 | UI | FR-08 / AC-09 | Admin management | List/search/create/edit/activation flows | client/tests/lab-03/UserManagement.test.tsx | Planned |
| UI-08 | UI | BR-15 / BR-16 | Admin safety feedback | Self/last-admin errors displayed | client/tests/lab-03/UserManagement.test.tsx | Planned |
| REG-01 | Regression | AC-11 | Lab 2 requester flow | Authenticated Requester can use ticket/attachment screens | server/tests/lab-03/requester-regression.api.test.ts | Planned |
| E2E-01 | E2E | AC-01 / AC-02 | Login and first password | Login, change, normal app access | e2e/lab-03/authentication.spec.ts | Planned |
| E2E-02 | E2E | AC-06 | Staff workflow | Queue → detail → claim → comment/note | e2e/lab-03/staff-ticket-flow.spec.ts | Planned |
| E2E-03 | E2E | AC-09 / AC-10 | Admin workflow | User management and safety rules | e2e/lab-03/user-administration.spec.ts | Planned |
| STYLE-01 | Style/Responsive | FR-10 | Zen Green and responsive screens | Desktop/tablet/mobile pass visual checklist | e2e/lab-03/responsive-screenshots.spec.ts | Planned |

## AC-to-Test Traceability

| Acceptance Criterion | Planned coverage |
|---|---|
| AC-01 | API-01, API-02, UI-01, E2E-01 |
| AC-02 | API-05, UI-02, E2E-01 |
| AC-03 | API-04, UI-03, E2E-01 |
| AC-04 | API-06, REG-01 |
| AC-05 | API-09, API-10, UI-04 |
| AC-06 | API-11, API-12, API-13, UI-05, E2E-02 |
| AC-07 | API-15, UI-06 |
| AC-08 | API-14, API-16, UI-06, E2E-02 |
| AC-09 | API-17, API-18, API-19, UI-07, E2E-03 |
| AC-10 | API-20, UI-08, E2E-03 |
| AC-11 | API-08, REG-01 |

## Required Final Evidence

Record backend, frontend, migration/regression, authorization, and E2E commands and their passing output from `main`. Include responsive screenshots, reviewer identity and PR links, AI-use reflection, and the final Answer Part 1-9 PDF.

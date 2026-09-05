# Lab 2 Test Plan and Results

## 1. Test Strategy

Lab 2 uses unit, API/integration, UI component, UI style, responsive, and end-to-end tests.

- Backend tests use Vitest and Supertest.
- Frontend tests use Vitest and React Testing Library.
- End-to-end tests use Playwright.
- Visual and responsive behaviour is checked using screenshots at desktop, tablet, and mobile sizes.
- API tests use a separate test database or clean up only records created by the test. Tests must never delete normal development data.

## 2. Planned-Test Table

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Planned Test File | Status |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | AC-02 | Ticket number generator | Formats a database ID as the required ticket number | `server/tests/lab-02/ticket-number.test.ts` | Passed |
| API-01 | API | AC-01 | Active requester list | Returns active requesters only | `server/tests/lab-02/requesters.api.test.ts` | Passed |
| API-02 | API | AC-02 | Valid ticket creation | Creates a ticket with generated number and `New` status | `server/tests/lab-02/create-ticket.api.test.ts` | Passed |
| API-03 | API | AC-03, BR-07 | Required-field validation and duplicate prevention | Rejects invalid ticket data with `400` and matching rapid resubmission with `409` | `server/tests/lab-02/create-ticket.api.test.ts` | Passed |
| API-04 | API | AC-04 | Active reference validation | Rejects inactive references with `400` and missing references with `404` | `server/tests/lab-02/create-ticket.api.test.ts` | Passed |
| API-05 | API | AC-05 | My Tickets query behaviour | Returns requester-owned tickets with search, filters, sorting, and pagination | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-06 | API | AC-06 | Ticket ownership | Rejects another requester trying to read ticket detail | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-07 | API | AC-07 | Attachment upload | Accepts allowed files within size and active-count limits | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-08 | API | AC-08 | Attachment soft removal | Stores `removedAt` and removal reason, retains metadata, and blocks download | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| UI-01 | UI Component | AC-01 | Development Requester selector | Displays active requesters and saves the selected requester | `client/tests/lab-02/RequesterSelector.test.tsx` | Passed |
| UI-02 | UI Component | AC-03 | Create Ticket validation | Shows field messages and does not call the API when invalid | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-03 | UI Component | AC-05 | My Tickets screen | Displays loading, empty, no-results, and ticket-list states | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-04 | UI Component | AC-08 | Attachment section | Shows active and removed attachment states and confirms removal reason | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| STYLE-01 | UI Style | AC-09 | Zen Green design tokens | Checks required classes, labels, validation placement, and button busy state | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| RESPONSIVE-01 | Responsive | AC-09 | Responsive layouts | Checks desktop, tablet, and mobile screenshots for clipping or overflow | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-01 | End-to-end | AC-02, AC-05, AC-06 | Requester ticket flow | Requester A creates and finds a ticket; Requester B cannot access it | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-02 | End-to-end | AC-07, AC-08 | Attachment lifecycle | Owner uploads and soft-removes an attachment; removed file cannot download | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| DB-01 | Database Integration | Data Changes, AC-01, AC-04 | Lab 2 schema and idempotent seed data | Required categories, seven related systems, four active requesters, and one inactive requester exist without duplicates | `server/tests/lab-02/data-model.test.ts` | Passed |

## 3. Acceptance-Criterion Traceability

| Acceptance Criterion | Planned Tests | Evidence Required |
| --- | --- | --- |
| AC-01 — Development Requester Selection | DB-01, API-01, UI-01 | Seed-data test, API result, and requester selector screenshot |
| AC-02 — Create Valid Ticket | UNIT-01, API-02, E2E-01 | Passing test output and created ticket screenshot |
| AC-03 — Ticket Validation | API-03, UI-02 | Passing tests and validation-message screenshot |
| AC-04 — Active Reference Validation | DB-01, API-04 | Seed-data test and passing API test output |
| AC-05 — Requester-Owned Ticket List | API-05, UI-03, E2E-01 | My Tickets screenshot with search, filters, sorting, and pagination |
| AC-06 — Ownership Protection | API-06, E2E-01 | Passing API test and cross-requester access evidence |
| AC-07 — Upload Attachment | API-07, E2E-02 | Passing test and uploaded attachment screenshot |
| AC-08 — Soft-Remove Attachment | API-08, UI-04, E2E-02 | Removed metadata, removal reason, and blocked-download evidence |
| AC-09 — Responsive Zen Green UI | STYLE-01, RESPONSIVE-01 | Desktop, tablet, and mobile screenshots plus visual checklist |

## 4. Responsive and Visual Checklist

- [ ] Zen Green colors match `ui-spec.md`.
- [ ] Header, navigation, primary actions, and active states use the required green tokens.
- [ ] Editable and read-only fields are visually distinct.
- [ ] Required-field markers and field-level validation messages are visible.
- [ ] Buttons have clear text, focus styles, disabled states, and busy states.
- [ ] No labels, errors, attachment names, or controls are clipped.
- [ ] No unintended horizontal scrolling appears on desktop, tablet, or mobile.
- [ ] My Tickets uses a readable table on desktop and a suitable responsive layout on smaller screens.
- [ ] Empty, no-results, loading, success, and failure states are clear.
- [ ] Active and removed attachments have visibly different states.

## 5. Test Commands

Backend tests:

```powershell
cd server
npm test
```

Frontend tests:

```powershell
cd client
npm test
```

Frontend production build:

```powershell
cd client
npm run build
```

Backend production build:

```powershell
cd server
npm run build
```

End-to-end tests:

```powershell
npx playwright test
```

## 6. Final Results

Issue #13 verification results:

- Backend: 4 test files and 9 tests passed.
- Frontend: 2 test files and 7 tests passed.
- Backend and frontend TypeScript production builds passed.
- API-01 verifies that only active requesters are returned in ID order.
- UI-01 verifies loading, selection, persistence, changing requester, and API failure states.

Issue #14 verification results:

- UNIT-01 verifies the backend ticket-number format.
- API-02 verifies that a valid request creates a ticket with a backend-generated number and `New` status.
- API-03 verifies required values, invalid priority, and duplicate submission protection.
- API-04 verifies missing and inactive requester, category, and related-system handling.

Final submission evidence must show that all required tests pass and that no required test is skipped, disabled, or commented out.

## 7. Known Limitations or Deferred Tests

At the planning stage, tests are marked as planned because implementation has not started yet.

Any change to a requirement, API endpoint, UI behaviour, or business rule must also update this test plan and its acceptance-criterion traceability.

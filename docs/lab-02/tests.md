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
| API-03B | API Boundary | AC-03, BR-04 | Summary and description length limits | Accepts 100-character summaries and 2,000-character descriptions; rejects 101-character summaries and 2,001-character descriptions with `400` | `server/tests/lab-02/create-ticket.api.test.ts` | Passed |
| API-04 | API | AC-04 | Active reference validation | Rejects inactive references with `400` and missing references with `404` | `server/tests/lab-02/create-ticket.api.test.ts` | Passed |
| API-05 | API | AC-05 | My Tickets query behaviour | Returns requester-owned tickets newest-first by default, supports search and combined filters, and rejects invalid requester or paging input | `server/tests/lab-02/my-tickets.api.test.ts` | Passed |
| API-06 | API | AC-06 | Ticket detail ownership | Returns a ticket detail only for the owner and rejects another requester with `403` | `server/tests/lab-02/ticket-detail-attachments.api.test.ts` | Passed |
| API-07 | API | AC-07, BR-08, BR-09 | Attachment upload validation | Uploads permitted files for the ticket owner and rejects unsupported type, over-size, over-count, and non-owner upload attempts | `server/tests/lab-02/ticket-detail-attachments.api.test.ts` | Passed |
| API-07B | API | AC-07 | Attachment inspection and download | Lists public attachment metadata and downloads active files only for the ticket owner | `server/tests/lab-02/ticket-detail-attachments.api.test.ts` | Passed |
| API-08 | API | AC-08 | Attachment soft removal | Stores `removedAt` and removal reason, retains metadata, and blocks download with `410` | `server/tests/lab-02/ticket-detail-attachments.api.test.ts` | Passed |
| UI-01 | UI Component | AC-01 | Development Requester selector | Displays active requesters and saves the selected requester | `client/tests/lab-02/RequesterSelector.test.tsx` | Passed |
| UI-02 | UI Component | AC-02, AC-03 | Create Ticket form and validation | Loads active reference data, shows field messages without calling the API when invalid, submits the selected requester, shows a disabled `Submitting...` state while waiting, and keeps data after an API error | `client/tests/lab-02/CreateTicket.test.tsx` | Passed |
| UI-03 | UI Component | AC-05 | My Tickets screen | Displays a requester-owned ticket list, filter controls, and a helpful empty state | `client/tests/lab-02/MyTickets.test.tsx` | Passed |
| UI-04 | UI Component | AC-06, AC-07, AC-08 | Ticket Detail and attachment section | Opens a ticket detail screen, uploads a selected attachment, blocks unsupported files, disables upload at five active attachments, shows active and removed attachment states, provides download links, and confirms removal reason before soft removal | `client/tests/lab-02/TicketDetail.test.tsx` | Passed |
| STYLE-01 | UI Style | AC-09 | Zen Green design tokens | Uses the documented design tokens, required labels, field-level validation placement, and a busy submit state | `client/tests/lab-02/CreateTicket.test.tsx` | Passed |
| RESPONSIVE-01 | Responsive | AC-09 | Responsive layouts | Checks desktop, tablet, and mobile screenshots for clipping or overflow | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-01 | End-to-end | AC-02, AC-05, AC-06 | Requester ticket flow | Requester A creates and finds a ticket; Requester B cannot access it | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-02 | End-to-end | AC-07, AC-08 | Attachment lifecycle | Owner uploads and soft-removes an attachment; removed file cannot download | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| DB-01 | Database Integration | Data Changes, AC-01, AC-04 | Lab 2 schema and idempotent seed data | Required categories, seven related systems, four active requesters, and one inactive requester exist without duplicates | `server/tests/lab-02/data-model.test.ts` | Passed |

## 3. Acceptance-Criterion Traceability

| Acceptance Criterion | Planned Tests | Evidence Required |
| --- | --- | --- |
| AC-01 — Development Requester Selection | DB-01, API-01, UI-01 | Seed-data test, API result, and requester selector screenshot |
| AC-02 — Create Valid Ticket | UNIT-01, API-02, E2E-01 | Passing test output and created ticket screenshot |
| AC-03 — Ticket Validation | API-03, API-03B, UI-02 | Passing tests and validation-message screenshot |
| AC-04 — Active Reference Validation | DB-01, API-04 | Seed-data test and passing API test output |
| AC-05 — Requester-Owned Ticket List | API-05, UI-03, E2E-01 | My Tickets screenshot with search, filters, sorting, and pagination |
| AC-06 — Ownership Protection | API-06, UI-04, E2E-01 | Passing API test, Ticket Detail screenshot, and cross-requester access evidence |
| AC-07 — Upload/View/Download Attachment | API-07, API-07B, UI-04, E2E-02 | Upload test output, attachment metadata list, download link, and uploaded attachment screenshot |
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
- API-03B verifies the exact and over-limit boundaries for summary (100/101 characters) and description (2,000/2,001 characters).
- API-04 verifies missing and inactive requester, category, and related-system handling.

Issue #15 verification results:

- UI-02 verifies client-side required-field validation, successful submission using the selected requester, a disabled `Submitting...` state while the API request is pending, and preserving entered data after an API error.
- STYLE-01 verifies the Create Ticket form uses the documented Zen Green UI classes, field labels, error placement, and the busy submit state covered by UI-02.
- The form reads active categories and related systems, while the backend also validates those values before creating a ticket.

Issue #17 verification results:

- API-06 verifies that a requester can open their own ticket detail and that another requester receives `403`.
- API-07 verifies that the owner can upload allowed attachments and that unsupported type, over-size, over-count, and non-owner upload attempts are rejected.
- API-07B verifies that attachment metadata is public-safe, active attachments can be downloaded by the owner, and another requester cannot download them.
- API-08 verifies soft removal by saving `removedAt` and `removalReason`, keeping the metadata row, and blocking future downloads with `410`.
- UI-04 verifies the Ticket Detail screen, attachment upload picker, successful upload refresh, unsupported-file validation, five-file disabled state, attachment list, download link, soft-remove prompt, removed state, and Back navigation from detail to My Tickets.

Final submission evidence must show that all required tests pass and that no required test is skipped, disabled, or commented out.

## 7. Known Limitations or Deferred Tests

At the planning stage, tests are marked as planned because implementation has not started yet.

Any change to a requirement, API endpoint, UI behaviour, or business rule must also update this test plan and its acceptance-criterion traceability.

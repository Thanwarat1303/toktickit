# Lab 2 Test Plan

## 1. Test Strategy

Lab 2 uses three types of testing:

- Backend API tests with Vitest and Supertest.
- Frontend component tests with Vitest and React Testing Library.
- Manual browser testing for complete user flows and visual behaviour.

Tests must use a separate test database or safely clean up only data created by the test. A test must never delete normal development data.

## 2. Backend API Tests

### Reference Data

- GET categories returns only active categories.
- GET related systems returns only active related systems.
- GET requesters returns only active requesters.
- Inactive records do not appear in the reference-data responses.

### Create Ticket

- Creates a ticket when all valid fields are provided.
- Returns `400` when a required field is missing.
- Returns `400` when summary is too long.
- Returns `400` when description is too long.
- Returns `400` when priority is not Low, Medium, or High.
- Rejects an inactive category.
- Rejects an inactive related system.
- Rejects an inactive or missing requester.
- Generates a unique ticket number in the backend.
- Creates the ticket with status `New`.
- Rejects duplicate ticket submissions according to the duplicate rule.

### My Tickets and Ticket Detail

- Returns only tickets owned by the requester in `X-Requester-Id`.
- Search returns matching ticket number or summary.
- Filters work for status, category, related system, and priority.
- Sorting and pagination return predictable results.
- A requester cannot access another requester's ticket detail.
- A missing ticket returns a safe `404` response.

### Attachments

- The ticket owner can upload an allowed file.
- Unsupported file type is rejected.
- Oversized file is rejected.
- The ticket owner can download an attachment.
- The ticket owner can delete an attachment.
- Another requester cannot upload, download, or delete an attachment for someone else's ticket.

## 3. Frontend Tests

- The Development Requester selector displays active requesters.
- The Create Ticket form renders all required fields.
- Invalid form input shows validation messages.
- Successful ticket creation shows success feedback.
- API failure shows a friendly error message.
- My Tickets displays ticket data returned by the API.
- Empty ticket results show an empty-state message.
- Ticket Detail displays the selected ticket data.
- Loading states are visible while waiting for the API.

## 4. Manual Test Scenarios

### Scenario 1: Create a Valid Ticket

1. Select an active development requester.
2. Open Create Ticket.
3. Select a category and related system.
4. Enter a valid summary and description.
5. Select a priority.
6. Submit the form.
7. Confirm that a ticket number is displayed and status is `New`.

### Scenario 2: Validation

1. Open Create Ticket.
2. Submit the form without entering required fields.
3. Confirm that clear validation messages appear.
4. Enter an invalid priority or too-long text.
5. Confirm that submission is rejected with a useful message.

### Scenario 3: Ownership Protection

1. Create a ticket as Requester A.
2. Change the selected requester to Requester B.
3. Open My Tickets and confirm that Requester A's ticket is not shown.
4. Try to open Requester A's ticket URL as Requester B.
5. Confirm that the application does not expose the ticket data.

### Scenario 4: Attachments

1. Open a ticket owned by the selected requester.
2. Upload an allowed file.
3. Confirm that the file appears in the attachment list.
4. Download the file.
5. Delete the file and confirm that it disappears.
6. Try the same action as another requester and confirm that access is rejected.

## 5. Evidence to Collect

Capture screenshots for:

- Passing backend API tests.
- Passing frontend tests.
- A valid ticket being created.
- Validation error messages.
- My Tickets with search or filters.
- Ticket detail page.
- Attachment upload and deletion.
- Ownership protection or safe access-denied behaviour.
- GitHub Project board and approved pull requests.
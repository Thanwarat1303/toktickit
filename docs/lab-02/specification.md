# Lab 2 Sprint Engineering Specification

## 1. Sprint Goal

Build a requester-facing IT support ticketing MVP for TokTickIT.

A requester should be able to select a development requester profile, create an IT support ticket, view only their own tickets, open ticket details, and manage attachments. The system must validate input, use active reference data, and protect each requester's ticket data from other requesters.

## 2. Stakeholder Request Interpretation

The stakeholder needs a simple IT service desk website where users can report IT problems and follow up on their submitted tickets.

For Lab 2, real login is not required. Instead, the application uses a Development Requester selector so the system can be tested as different users. The selected requester must only see and access tickets that belong to that requester.

Each ticket must contain a requester, category, related system, summary, description, and priority. The backend creates the ticket number and sets the first status to `New`.

## 3. Scope

### Included

- Development Requester selector for local testing.
- Active categories, related systems, and requesters as reference data.
- Create Ticket form with validation.
- Backend API for creating tickets.
- Backend-generated unique ticket numbers.
- Default ticket status of `New`.
- My Tickets page with search, filter, sorting, and pagination.
- Ticket detail page for the ticket owner.
- Attachment upload, display, download, and deletion for the ticket owner.
- Automated API and frontend tests.
- Engineering documents, peer review, GitHub Project board, pull requests, and evidence for the lab submission.

### Excluded

- Real user authentication and password management.
- IT staff workflow, ticket assignment, and status updates by staff.
- Email notifications.
- Production deployment.
- Complex file preview features.
## 4. Functional Requirements

### FR-01: Development Requester Selection

The application must show a Development Requester selector.  
The selected requester is used as the current user for local testing.

Only active requesters can be selected. Changing the selected requester must update the tickets shown in My Tickets.

### FR-02: Reference Data

The application must load and display only active categories, related systems, and requesters.

A user cannot create a ticket using an inactive or missing reference record.

### FR-03: Create Ticket

The requester must be able to create a ticket by providing:

- Category
- Related system
- Summary
- Description
- Priority

The application must show useful validation messages when required information is missing or invalid.

### FR-04: My Tickets

The requester must be able to view only tickets that belong to the selected requester.

The list must support:

- Search by ticket number or summary
- Filter by status, category, related system, and priority
- Sorting
- Pagination

### FR-05: Ticket Detail

The requester must be able to open a ticket detail page for their own ticket.

The page must show the ticket number, status, requester, category, related system, summary, description, priority, created date, and attachments.

### FR-06: Attachments

The requester must be able to upload, view, download, and delete attachments for their own ticket.

The system must reject unsupported files or files that exceed the allowed size.

## 5. Business Rules

- **BR-01:** The backend generates the ticket number. The ticket number must be unique and must not be created by the frontend.
- **BR-02:** A newly created ticket must have the status `New`.
- **BR-03:** Only active categories, related systems, and requesters can be used when creating a ticket.
- **BR-04:** Summary and description are required. Summary must not be longer than 100 characters. Description must not be longer than 2,000 characters.
- **BR-05:** Priority must be one of `Low`, `Medium`, or `High`.
- **BR-06:** A requester can only view, open, upload attachments to, download attachments from, or delete attachments from their own tickets.
- **BR-07:** The system must prevent duplicate ticket submissions when the same requester submits the same ticket data more than once within a short period.
- **BR-08:** Uploaded attachment files must follow the allowed file type and maximum file size rules.
## 6. UI Specification Summary

The user interface should be clear, responsive, and easy to use.

The main pages are:

- Development Requester selection
- Create Ticket
- My Tickets
- Ticket Detail

The page should use consistent colors, spacing, buttons, validation messages, loading states, empty states, and error states. The layout must also work on a smaller mobile screen.

## 7. Data Changes

The database needs the following data models:

- `Category` — includes an `isActive` field.
- `RelatedSystem` — includes a name and an `isActive` field.
- `Requester` — includes name, email, and an `isActive` field.
- `Ticket` — stores ticket number, requester, category, related system, summary, description, priority, status, and timestamps.
- `Attachment` — stores attachment information and belongs to one ticket.

Seed data must include at least:

- 4 categories
- 6 related systems
- 4 active requesters
- 1 inactive requester

## 8. API Contract

The backend will provide APIs for:

- Reading active categories, related systems, and requesters.
- Creating a ticket.
- Reading the current requester's ticket list.
- Reading one ticket only when it belongs to the current requester.
- Uploading, downloading, and deleting attachments only when the ticket belongs to the current requester.

Each API must validate input and return safe error messages. The detailed request and response formats are documented in `api-spec.md`.

## 9. Acceptance Criteria

The sprint is accepted when:

- The requester can select an active development requester.
- The Create Ticket form loads active reference data.
- A valid ticket can be created successfully.
- Invalid ticket data shows clear validation errors.
- The backend generates a unique ticket number.
- A new ticket has status `New`.
- A requester can only see their own tickets.
- Search, filters, sorting, and pagination work on My Tickets.
- A requester can view details only for their own ticket.
- Attachment ownership and validation rules work correctly.
- Automated tests pass.
- Required documents, GitHub Project activity, peer-review evidence, and screenshots are included.

## 10. Definition of Done

This sprint is done when the feature works according to the acceptance criteria, tests pass, the code is committed to a feature branch, a pull request is opened to `lab2-staging`, a peer review is completed, and the documentation is updated.

## 11. Assumptions and Decisions

- This lab uses a Development Requester selector instead of real authentication.
- PostgreSQL and Prisma are used for persistent data.
- The selected requester identity is sent with requests only for development and testing.
- Ticket numbers are created by the backend because the frontend must not control unique business identifiers.
- The project will use the existing GitHub Project board to track issue status.
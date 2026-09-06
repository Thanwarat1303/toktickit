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
- My Tickets page with search, filtering, sorting, and pagination.
- Ticket detail page for the ticket owner.
- Attachment upload, metadata display, download, and soft removal for the ticket owner.
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

The selected requester is used as the current user for local testing. Only active requesters can be selected. Changing the selected requester must update the tickets shown in My Tickets.

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
- An optional supporting attachment (JPG/JPEG, PNG, WEBP, or PDF, up to 5 MB)

The application must show useful validation messages when required information is missing or invalid.

After the ticket is created, the application uploads the optional attachment against that new ticket. Attachment upload, download, and soft removal are implemented as the dedicated attachment feature so the same ownership and file-validation rules are used everywhere.

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

The requester must be able to upload, view metadata for, download, and soft-remove attachments for their own ticket.

Before soft removal, the requester must provide a removal reason and confirm the action.

A removed attachment remains visible as metadata in Ticket Detail, but it cannot be downloaded or previewed.

The system must reject unsupported files or files that exceed the allowed size.

## 5. Business Rules

- BR-01: The backend generates the ticket number. The ticket number must be unique and must not be created by the frontend.
- BR-02: A newly created ticket must have the status `New`.
- BR-03: Only active categories, related systems, and requesters can be used when creating a ticket.
- BR-04: Summary and description are required. Summary must not be longer than 100 characters. Description must not be longer than 2,000 characters.
- BR-05: Priority must be one of `Low`, `Medium`, or `High`.
- BR-06: A requester can view only their own tickets and ticket details.
- BR-07: The system must prevent duplicate ticket submissions when the same requester submits the same ticket data more than once within a short period.
- BR-08: Allowed attachment types are JPG/JPEG, PNG, WEBP, and PDF. Each file must not be larger than 5 MB.
- BR-09: A ticket can have at most five active attachments.
- BR-10: Attachment removal must use soft removal. The attachment metadata remains in the database, but a removed attachment cannot be downloaded or previewed.
- BR-11: Only the ticket owner can upload or soft-remove an attachment. A removal reason is required before an attachment is soft-removed.

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

- `Category` — includes a unique name, an `isActive` field, and a creation timestamp.
- `RelatedSystem` — includes a unique name, an `isActive` field, and a creation timestamp.
- `Requester` — includes name, unique email, an `isActive` field, and a creation timestamp.
- `Ticket` — stores ticket number, requester, category, related system, summary, description, priority, status, and timestamps.
- `Attachment` — belongs to one ticket and stores `originalFilename`, `storedFilename`, `mimeType`, `sizeBytes`, `createdAt`, `removedAt`, and `removalReason`.

The `Attachment` model uses `removedAt` as the soft-removal marker. An active attachment has `removedAt = null`.

A removed attachment keeps its metadata for audit purposes but must not be downloadable or previewable.

The database includes an index for `Attachment.ticketId` because attachments are commonly loaded by ticket. The ticket number must be unique.

The seed data includes:

- Four active required categories: Account and Access, Hardware, Software, and Network
- One inactive category: Legacy Service
- Seven active related systems
- One inactive related system: Legacy Student Portal
- Four active development requesters
- One inactive development requester

The seed uses `upsert` with unique category names, related-system names, and requester emails. It can therefore be executed repeatedly without creating duplicate seed records.

### Future Schema Evolution for Lab 3

Lab 2 uses the `Requester` model and the Development Requester selector for local testing without real authentication.

In Lab 3, requester identity will be connected to a real authenticated user. The database may introduce a `User` model to store authentication information such as login identity and password-related data.

The existing `Requester` model can remain as a requester profile linked to one authenticated `User`, or its profile fields can be migrated into the authenticated user model.

The `requesterId` relationship on `Ticket` must be preserved or migrated safely so that existing tickets continue to belong to the correct requester after authentication is introduced.

Authentication secrets and password hashes must not be stored directly in the existing development requester selector.

## 8. API Contract

The backend will provide APIs for:

- Reading active categories, related systems, and requesters.
- Creating a ticket.
- Reading the current requester's ticket list.
- Reading one ticket only when it belongs to the current requester.
- Uploading attachments for a ticket owned by the current requester.
- Retrieving attachment metadata.
- Downloading active attachments.
- Soft-removing attachments owned by the current requester.

Each API must validate input and return safe error messages. The detailed request and response formats are documented in `api-spec.md`.

## 9. Acceptance Criteria

### AC-01 — Development Requester Selection

**Given** active and inactive requesters exist,  
**When** the user opens the requester selection screen,  
**Then** the system displays only active requesters and allows one requester to be selected.

### AC-02 — Create Valid Ticket

**Given** a requester has selected valid category, related system, summary, description, and priority values,  
**When** the requester submits the Create Ticket form,  
**Then** the backend creates the ticket with a unique ticket number and status `New`.

### AC-03 — Ticket Validation

**Given** one or more required ticket fields are missing or invalid,  
**When** the requester submits the form,  
**Then** the system shows a clear validation message and does not create a ticket.

### AC-04 — Active Reference Validation

**Given** a category, related system, or requester is inactive or missing,  
**When** a ticket creation request uses that record,  
**Then** the backend rejects the request safely.

### AC-05 — Requester-Owned Ticket List

**Given** a requester has selected their identity,  
**When** they open My Tickets,  
**Then** the system returns only tickets owned by that requester and supports search, filtering, sorting, and pagination.

### AC-06 — Ownership Protection

**Given** Requester B tries to access a ticket owned by Requester A,  
**When** Requester B requests the ticket detail,  
**Then** the system returns a safe not-found or access-denied response without exposing ticket data.

### AC-07 — Upload Attachment

**Given** the selected requester owns a ticket and selects an allowed file within the size and count limits,  
**When** they upload the file,  
**Then** the system stores the attachment metadata and makes the active attachment visible on the ticket.

### AC-08 — Soft-Remove Attachment

**Given** the selected requester owns an active attachment and provides a removal reason,  
**When** they confirm removal,  
**Then** the system records the attachment as removed, retains its metadata, and blocks future download or preview.

### AC-09 — Responsive Zen Green UI

**Given** the application is opened on desktop, tablet, or mobile,  
**When** the requester uses Create Ticket, My Tickets, or Ticket Detail,  
**Then** the layout remains readable, usable, and follows the required Zen Green visual rules.

## 10. Definition of Done

This sprint is done when:

- The implementation satisfies the acceptance criteria.
- Automated tests pass.
- The frontend and backend builds pass.
- The code is committed to the correct feature branch.
- A pull request is opened to `lab2-staging`.
- A peer review and approval are completed.
- The GitHub Project board is updated.
- The Lab 2 documents and submission evidence are updated.

## 11. Assumptions and Decisions

- This lab uses a Development Requester selector instead of real authentication.
- PostgreSQL and Prisma are used for persistent data.
- The selected requester identity is sent with requests only for development and testing.
- Ticket numbers are created by the backend because the frontend must not control unique business identifiers.
- The project uses the existing GitHub Project board to track issue status.
- Inactive category and related-system fixtures are included so that BR-03 and AC-04 can be tested during the Create Ticket API implementation.
- Attachment removal is always soft removal; the database record and metadata are retained.

# Lab 3 Engineering Specification

## 1. Sprint Goal

Replace the Lab 2 development requester selector with secure authenticated users and role-based access. Preserve all Lab 2 requester ticket and attachment behavior while adding IT Staff ticket operations and a minimal Administrator user-management workflow.

## 2. Stakeholder Request

Users sign in with an email and password. Requesters continue managing their own tickets. IT Staff work from a shared queue and communicate through public comments and private internal notes. Administrators manage user accounts. Every protected operation is authorized by the backend.

## 3. Scope

### Included

- Login, logout, current-user retrieval, and mandatory first-login password change.
- Three single-role account types: Requester, IT Staff, and Administrator.
- Server-side authentication, role authorization, and ownership checks.
- Migration of Lab 2 requester ownership to authenticated users.
- Requester regression: tickets, attachments, public comments, and resolution indication.
- IT Staff queue, claim/reassign, IT Priority, status workflow, public comments, and internal notes.
- Minimal Administrator user list, search, optional role filter, create/edit, activation, and initial-password reset.
- Lab 2 data-preserving migration, seed data, automated tests, E2E tests, and responsive evidence.

### Explicitly excluded

Email delivery, invitations, password-reset email, MFA, social login, SSO, self-registration, user deletion, bulk operations, import/export, multiple roles, departments, audit history, SLA/escalation services, dashboards, multi-tenancy, and production deployment.

## 4. Functional Requirements

- FR-01: An active user can authenticate with email and password.
- FR-02: A user flagged for an initial password change cannot access normal application screens until a valid new password is saved.
- FR-03: An authenticated user can retrieve their own identity and role and can log out.
- FR-04: The application displays only navigation and actions permitted for the authenticated role; the backend remains the security boundary.
- FR-05: A Requester can create, view, and manage only their own Lab 2 tickets and permitted attachments, add public comments, and indicate that a problem appears resolved.
- FR-06: IT Staff can search and operate a shared ticket queue, open tickets, claim/reassign ownership, set IT Priority, perform permitted status transitions, add public comments, and create internal notes.
- FR-07: Public Comments are visible to permitted participants; Internal Notes are visible only to IT Staff and Administrator.
- FR-08: An Administrator can list/search users, create and edit users, assign one role, activate/deactivate accounts, and set a new initial password.
- FR-09: Existing Lab 2 Categories, Related Systems, Tickets, and Attachments remain valid after migration.
- FR-10: Required screens provide loading, saving, validation, success, empty/no-results, forbidden, not-found, conflict, and safe failure feedback where applicable.

## 5. Business Rules

- BR-01: Only an active user with valid credentials may authenticate.
- BR-02: A user requiring a password change cannot enter normal application screens before changing it.
- BR-03: Ownership comes from the authenticated identity; client-supplied requester IDs cannot select another user's data.
- BR-04: Passwords are stored only as strong hashes and are never returned to clients.
- BR-05: A user has exactly one permitted role: Requester, IT Staff, or Administrator.
- BR-06: Public Comments are visible to Requester, IT Staff, and Administrator when permitted; Internal Notes are visible only to IT Staff and Administrator.
- BR-07: Comments and notes are append-only, non-empty, length-limited, and rendered safely as text.
- BR-08: A Requester may indicate apparent resolution but cannot formally set a ticket to Resolved or Closed.
- BR-09: Each ticket has zero or one primary owner, and an owner must be an active IT Staff or permitted Administrator.
- BR-10: Requested Priority remains the Requester's value; IT Priority initially copies it and can be changed only by permitted staff roles.
- BR-11: Ticket status must use the defined values: New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, and Cancelled.
- BR-12: Status changes follow the approved transition matrix and reject invalid transitions safely.
- BR-13: Inactive users cannot log in or be assigned new ticket ownership.
- BR-14: Email addresses are unique case-insensitively.
- BR-15: An Administrator cannot deactivate their own account.
- BR-16: The system must always retain at least one active Administrator.
- BR-17: User deactivation is used instead of user deletion.
- BR-18: Protected endpoints distinguish unauthenticated, forbidden, invalid, missing, conflict, and unexpected failures without leaking protected resources.
- BR-19: After five failed login attempts for the same account or source address within 15 minutes, further login attempts are temporarily rejected for 15 minutes; the response remains the same safe `401` used for invalid credentials.

## 6. Authorization Matrix

| Operation | Requester | IT Staff | Administrator |
|---|---:|---:|---:|
| Login/logout/current user | Yes | Yes | Yes |
| Own ticket and attachment APIs | Own data only | No | As explicitly permitted |
| Public comments | Own tickets | Queue tickets | As explicitly permitted |
| Internal notes | No | Yes | Yes |
| Ticket queue | No | Yes | No unless later added to matrix |
| Claim/assign/reassign | No | Yes | No unless explicitly approved |
| IT Priority/status workflow | No | Yes | No unless explicitly approved |
| User management | No | No | Yes |

## 7. Ticket Status Transition Matrix

| From | Allowed next states | Role | Required confirmation |
|---|---|---|---|
| New | Open, Cancelled | IT Staff | None for Open; explicit staff confirmation for Cancelled |
| Open | In Progress, Waiting for Requester, Cancelled | IT Staff | None for In Progress/Waiting; explicit staff confirmation for Cancelled |
| In Progress | Waiting for Requester, Resolved, Cancelled | IT Staff | Explicit staff confirmation for Resolved/Cancelled |
| Waiting for Requester | In Progress, Resolved, Cancelled | IT Staff | Explicit staff confirmation for Resolved/Cancelled |
| Resolved | Closed, Reopened | IT Staff | Explicit staff confirmation for Closed; none for Reopened |
| Closed | Reopened | IT Staff | Explicit staff confirmation |
| Reopened | In Progress, Cancelled | IT Staff | None for In Progress; explicit staff confirmation for Cancelled |
| Cancelled | Reopened | IT Staff | Explicit staff confirmation |

Requester resolution indication is a separate flag and does not change formal status.

## 8. Data and Migration Decisions

Introduce `User` with unique email, name, passwordHash, role, isActive, mustChangePassword, createdAt, and updatedAt. Existing Requester records are migrated to Requester users using deterministic local initial passwords documented for development only. Existing ticket requester ownership is retained through the migrated user relation. Add ticket owner, IT Priority, workflow status, resolution indication, comments, and notes with author relations and indexes for queue queries. The migration must be forward-only and must not discard existing ticket or attachment rows.

The temporary Development Requester selector, its localStorage state, and requesterId-based ownership input are removed after authenticated identity is available.

## 9. Acceptance Criteria

- AC-01: Given an active user with valid credentials, when login is submitted, then authenticated access is established and the user identity and role are returned without secrets.
- AC-02: Given a user requiring an initial password change, when login succeeds, then normal application screens remain unavailable until a valid new password is saved.
- AC-03: Given an authenticated user, when logout is requested, then the session is invalidated and protected requests are rejected.
- AC-04: Given an authenticated Requester, when a client supplies another requester ID, then the backend still scopes data to the authenticated Requester.
- AC-05: Given an IT Staff user, when the queue is opened, then searchable, filterable, sortable, paginated tickets and ownership/status information are returned.
- AC-06: Given an IT Staff user, when a valid claim, assignment, priority update, or status transition is submitted, then the ticket is updated and the result is visible in detail.
- AC-07: Given a Requester, when an Internal Note operation is requested, then it is forbidden and no note content is exposed.
- AC-08: Given a permitted staff user, when a Public Comment or Internal Note is submitted with valid content, then it is appended with backend author and timestamp.
- AC-09: Given an Administrator, when a valid user-management operation is submitted, then the account is created or updated according to one-role and safety rules.
- AC-10: Given an Administrator attempting self-deactivation or removal of the last active Administrator, when the request is submitted, then it is rejected without changing account state.
- AC-11: Given migrated Lab 2 data, when authenticated Requester screens are used, then existing ticket and attachment ownership and behavior remain correct.

## 10. Definition of Done

- Contract documents are reviewed before implementation PRs are completed.
- Prisma migration preserves Lab 2 data and seed is idempotent.
- Backend authorization is enforced and negative tests pass.
- Login, password change, Requester, IT Staff, and Administrator screens work responsively.
- Backend, frontend, migration/regression, authorization, UI, and E2E tests pass from final `main`.
- `reviewer.md`, `ai-use.md`, screenshots, and one Answer Part 1-9 PDF are complete.
- Feature branches are merged into `lab3-staging`, then `lab3-staging` is merged into `main`.

## 11. Assumptions and Decisions

- Use an HTTP-only, same-site session cookie for this course stack. A session expires after 8 hours and is rejected by the server after expiry; logout invalidates it immediately.
- Protect state-changing cookie-authenticated requests with a CSRF token: the server issues a per-session token through the authenticated bootstrap/current-user response, and the client sends it in `X-CSRF-Token`; the server compares it before POST, PATCH, and DELETE operations. Login has no existing authenticated session and is exempt; GET/HEAD/OPTIONS are read-only.
- Use a maintained password-hashing library such as bcrypt or Argon2; local seed credentials are development-only.
- Keep Administrator and IT Staff responsibilities separate unless a later reviewed matrix explicitly permits overlap.
- Use safe generic authentication errors and avoid resource-existence leaks across ownership boundaries.

# Lab 3 API Contract

## General Rules

Base URL: `http://localhost:3000/api`. JSON is used unless an endpoint streams a file. Authentication uses an HTTP-only, same-site session cookie with an 8-hour server-enforced expiry. Protected endpoints return `401` when unauthenticated or when the session has expired and `403` when authenticated without permission. Error bodies use `{ "error": { "code": "...", "message": "..." } }` and never expose password hashes or protected resource existence unnecessarily.

For cookie-authenticated state-changing requests (`POST`, `PATCH`, and `DELETE`), the client must send `X-CSRF-Token` containing the per-session CSRF token issued by the authenticated bootstrap/current-user response. The server compares the header token with the session token before changing state. `GET`, `HEAD`, and `OPTIONS` are read-only and do not require the header. Login is exempt because no authenticated session exists yet. Same-site cookies, origin checking where available, and the CSRF header together prevent cross-site state-changing requests.

## Authentication

### `POST /api/auth/login`

Request: `{ "email": string, "password": string }`.

`200`: `{ "user": { "id", "name", "email", "role", "isActive", "mustChangePassword" }, "csrfToken": string }` and a session cookie. Invalid, inactive, or temporarily rate-limited credentials return the same safe `401` response. After five failed attempts for the same account or source address within 15 minutes, further attempts are rejected for 15 minutes. Validation errors return `400`.

### `POST /api/auth/logout`

Requires authentication. `204` invalidates the session.

### `GET /api/auth/me`

Requires authentication. `200` returns the safe current-user object and the current session's CSRF token:
`{ "user": { "id", "name", "email", "role", "isActive", "mustChangePassword" }, "csrfToken": string }`.
The token is returned for every valid session, including a session restored after a page reload, so the
client does not need to log in again just to bootstrap CSRF protection. The client must use this token in
`X-CSRF-Token` for subsequent state-changing requests. `401` if no valid session exists.

### `POST /api/auth/change-password`

Requires authentication and a user flagged for password change. Request: `{ "currentPassword": string, "newPassword": string, "confirmPassword": string }`. `200` clears `mustChangePassword`; invalid values return `400`; unauthenticated returns `401`.

## Requester Continuation APIs

All Lab 2 ticket and attachment endpoints remain available, but ownership is derived from the authenticated user. Client-supplied `requesterId` is ignored or rejected and cannot select another account. Existing response shapes and soft-removal rules remain unless explicitly extended below. Requester-only operations require an authenticated Requester and return `403` for other roles.

## IT Staff Queue and Ticket Operations

### `GET /api/staff/tickets`

Requires IT Staff authorization. Query parameters: `search`, suitable status/priority/category/owner filters, `sortBy`, `sortDir`, `page`, and `pageSize` (maximum 50). The contract must return `{ "tickets": [...], "pagination": { "page", "pageSize", "totalItems", "totalPages" } }`. Invalid query values return `400`.

### `GET /api/staff/tickets/:id`

Requires IT Staff authorization. Returns ticket details, owner, workflow fields, public comments, permitted internal notes, and attachment metadata. Missing ticket returns `404`.

### `POST /api/staff/tickets/:id/claim`

Requires IT Staff. Claims the ticket for the current staff user. Conflicting ownership returns `409`.

### `PATCH /api/staff/tickets/:id/owner`

Requires IT Staff. Request: `{ "ownerId": number | null }`. The owner must be an active IT Staff or explicitly permitted Administrator. Invalid role/inactive owner returns `400` or `409`.

### `PATCH /api/staff/tickets/:id/workflow`

Requires IT Staff. Request may contain `{ "itPriority": "Low"|"Medium"|"High"|"Urgent", "status": ... }`. Invalid transitions return `409`; invalid values return `400`.

## Comments and Notes

### `GET /api/tickets/:id/comments` / `POST /api/tickets/:id/comments`

Requires an authenticated permitted participant. POST request: `{ "content": string }`. Empty, whitespace-only, or over-limit content returns `400`. The response includes id, ticketId, author, content, and backend-created timestamp.

### `GET /api/tickets/:id/notes` / `POST /api/tickets/:id/notes`

Requires IT Staff or Administrator. Request shape matches comments. Requester access returns `403` without note content.

## Administrator User Management

All endpoints below require Administrator authorization.

### `GET /api/admin/users`

Optional query parameters: `search` for name/email and `role`. Returns safe user fields only. Invalid role returns `400`.

### `POST /api/admin/users`

Request: `{ "name", "email", "role", "isActive", "initialPassword" }`. Creates exactly one permitted role. Duplicate email returns `409`; invalid input/role returns `400`.

### `PATCH /api/admin/users/:id`

Request may update `name`, `email`, `role`, and `isActive`. Duplicate email returns `409`. Self-deactivation and removal of the last active Administrator return `409`.

### `POST /api/admin/users/:id/initial-password`

Request: `{ "initialPassword": string }`. Sets a new hash and sets `mustChangePassword=true`. The password is never returned.

## Safe Error and Validation Rules

Use `400` for malformed input, `401` for missing/invalid authentication, `403` for forbidden roles, `404` for missing resources where disclosure is safe, `409` for ownership/state conflicts, and `500` for unexpected failures with a generic message. Every endpoint must define and test its authorization behavior.

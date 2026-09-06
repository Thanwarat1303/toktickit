# Lab 2 API Contract

## 1. General Rules

Base URL:

```text
http://localhost:3000/api
```

All normal requests and responses use JSON.

For requester-owned data, the frontend sends the selected requester ID in this header:

```text
X-Requester-Id: <requester id>
```

The backend must validate this requester ID before returning or changing requester-owned data.

## 2. Reference Data APIs

### GET /api/categories

Returns active ticket categories.

Response `200`:

```json
[
  { "id": 1, "name": "Hardware" },
  { "id": 2, "name": "Software" }
]
```

### GET /api/related-systems

Returns active related systems.

Response `200`:

```json
[
  { "id": 1, "name": "Student Portal" },
  { "id": 2, "name": "University Wi-Fi" }
]
```

### GET /api/requesters

Returns active development requesters for the requester selector.

Response `200`:

```json
[
  { "id": 1, "name": "Alice Smith", "email": "alice@example.com" }
]
```

## 3. Create Ticket API

### POST /api/tickets

Creates a new IT support ticket.

Request headers:

```text
Content-Type: application/json
X-Requester-Id: 1
```

Request body:

```json
{
  "categoryId": 1,
  "relatedSystemId": 2,
  "summary": "Cannot connect to university Wi-Fi",
  "description": "My laptop cannot connect to the campus Wi-Fi since this morning.",
  "priority": "Medium"
}
```

Success response `201`:

```json
{
  "id": 1,
  "ticketNumber": "TK-000001",
  "status": "New",
  "requesterId": 1,
  "categoryId": 1,
  "relatedSystemId": 2,
  "summary": "Cannot connect to university Wi-Fi",
  "description": "My laptop cannot connect to the campus Wi-Fi since this morning.",
  "priority": "Medium",
  "createdAt": "2026-09-03T10:00:00.000Z"
}
```

Possible errors:

- `400` for missing or invalid fields.
- `400` when the selected requester, category, or related system is inactive.
- `404` when the requester, category, or related system does not exist.
- `409` when the same requester submits the same category, related system, summary, description, and priority within 60 seconds.
- `500` for an unexpected server error with a safe message.

## 4. My Tickets API

### GET /api/tickets

Returns only tickets owned by the selected requester.

Request headers:

```text
X-Requester-Id: 1
```

Optional query parameters:

```text
search
status
categoryId
relatedSystemId
priority
sortBy
sortOrder
page
pageSize
```

- `search` matches the ticket number or summary without case sensitivity.
- `status`, `categoryId`, `relatedSystemId`, and `priority` combine with AND logic.
- `sortBy` accepts `createdAt`, `summary`, or `priority`; `sortOrder` accepts `asc` or `desc`.
- The default is `createdAt` descending. `id` descending is used as a stable tie-breaker.
- `page` defaults to `1`; `pageSize` defaults to `10` and cannot exceed `50`.

Example:

```text
GET /api/tickets?search=wifi&status=New&page=1&pageSize=10
```

Success response `200`:

```json
{
  "items": [
    {
      "id": 1,
      "ticketNumber": "TK-000001",
      "summary": "Cannot connect to university Wi-Fi",
      "priority": "Medium",
      "status": "New",
      "category": { "id": 1, "name": "Network" },
      "relatedSystem": { "id": 2, "name": "University Wi-Fi" },
      "createdAt": "2026-09-03T10:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 1,
  "totalPages": 1
}
```

## 5. Ticket Detail API

### GET /api/tickets/:ticketId

Returns one ticket only when it belongs to the selected requester.

Request headers:

```text
X-Requester-Id: 1
```

Success response `200`:

```json
{
  "id": 1,
  "ticketNumber": "TK-000001",
  "status": "New",
  "requester": {
    "id": 1,
    "name": "Alice Smith",
    "email": "alice@example.com"
  },
  "category": { "id": 1, "name": "Network" },
  "relatedSystem": { "id": 2, "name": "University Wi-Fi" },
  "summary": "Cannot connect to university Wi-Fi",
  "description": "My laptop cannot connect to the campus Wi-Fi since this morning.",
  "priority": "Medium",
  "createdAt": "2026-09-03T10:00:00.000Z",
  "updatedAt": "2026-09-03T10:00:00.000Z"
}
```

Possible errors:

- `400` when `ticketId` or `X-Requester-Id` is missing or invalid.
- `403` when the ticket belongs to another requester.
- `404` when the ticket does not exist.
- `500` with a safe message when the detail cannot be loaded.

## 6. Attachment APIs

### GET /api/tickets/:ticketId/attachments

Returns attachment metadata for a ticket only when it belongs to the selected requester.

Request headers:

```text
X-Requester-Id: 1
```

Removed attachments remain visible in this response as metadata, with a non-null `removedAt` value.

Success response `200`:

```json
[
  {
    "id": 1,
    "ticketId": 1,
    "originalFilename": "network-error.png",
    "mimeType": "image/png",
    "sizeBytes": 2048,
    "createdAt": "2026-09-03T10:05:00.000Z",
    "removedAt": null,
    "removalReason": null
  }
]
```

The response must not expose the internal stored filename or server file path.

Possible errors:

- `400` when `ticketId` or `X-Requester-Id` is missing or invalid.
- `403` when the ticket belongs to another requester.
- `404` when the ticket does not exist.
- `500` with a safe message when the attachment list cannot be loaded.

### POST /api/tickets/:ticketId/attachments

Uploads an attachment for a ticket owned by the selected requester.

Request headers:

```text
X-Requester-Id: 1
Content-Type: multipart/form-data
```

The uploaded file field name is `file`.

The API accepts JPG/JPEG, PNG, WEBP, and PDF files only. Each file must not be larger than 5 MB, and a ticket can have at most five active attachments.

Success response `201`:

```json
{
  "id": 3,
  "ticketId": 1,
  "originalFilename": "network-error.png",
  "mimeType": "image/png",
  "sizeBytes": 2048,
  "createdAt": "2026-09-03T10:10:00.000Z",
  "removedAt": null,
  "removalReason": null
}
```

Possible errors:

- `400` when `ticketId`, `X-Requester-Id`, or the uploaded `file` field is missing or invalid.
- `403` when the ticket belongs to another requester.
- `404` when the ticket does not exist.
- `409` when the ticket already has five active attachments.
- `413` when the uploaded file is larger than 5 MB.
- `415` when the uploaded file type is not JPG/JPEG, PNG, WEBP, or PDF.
- `500` with a safe message when the attachment cannot be stored.

### GET /api/attachments/:attachmentId/download

Downloads an active attachment only when its ticket belongs to the selected requester.

The API must reject download when the attachment has been soft-removed.

Request identity:

```text
X-Requester-Id: 1
```

For browser download links, the requester id may also be sent as a query string:

```text
GET /api/attachments/1/download?requesterId=1
```

Possible errors:

- `400` when `attachmentId` or requester identity is missing or invalid.
- `403` when the attachment belongs to another requester.
- `404` when the attachment metadata or physical file cannot be found.
- `410` when the attachment has been soft-removed.
- `500` with a safe message when the file cannot be downloaded.

### DELETE /api/attachments/:attachmentId

Soft-removes an active attachment only when its ticket belongs to the selected requester.

Request headers:

```text
X-Requester-Id: 1
Content-Type: application/json
```

Request body:

```json
{
  "removalReason": "Uploaded the wrong file"
}
```

The API must keep the attachment metadata, set `removedAt`, save the removal reason, and block all future download or preview requests for that attachment.

Success response `200` returns the public metadata for the removed attachment:

```json
{
  "id": 1,
  "ticketId": 1,
  "originalFilename": "network-error.png",
  "mimeType": "image/png",
  "sizeBytes": 2048,
  "createdAt": "2026-09-03T10:05:00.000Z",
  "removedAt": "2026-09-03T10:10:00.000Z",
  "removalReason": "Uploaded the wrong file"
}
```

Possible errors:

- `400` when `attachmentId`, `X-Requester-Id`, or `removalReason` is missing or invalid.
- `403` when the attachment belongs to another requester.
- `404` when the attachment does not exist.
- `500` with a safe message when the attachment cannot be removed.
## 7. Error Response Format

Validation and safe application errors use this format:

```json
{
  "message": "A clear message for the user"
}
```

The API must not expose database errors, file paths, stack traces, or other internal server details.

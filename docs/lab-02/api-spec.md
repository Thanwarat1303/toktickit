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
- `404` when the requester, category, or related system does not exist.
- `409` when a duplicate ticket submission is detected.
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
  "attachments": [],
  "createdAt": "2026-09-03T10:00:00.000Z"
}
```

Possible errors:

- `404` when the ticket does not exist or does not belong to the selected requester.

## 6. Attachment APIs

### POST /api/tickets/:ticketId/attachments

Uploads an attachment for a ticket owned by the selected requester.

Request headers:

```text
X-Requester-Id: 1
Content-Type: multipart/form-data
```

The uploaded file field name is `file`.

Success response `201`:

```json
{
  "id": 1,
  "fileName": "wifi-error.png",
  "mimeType": "image/png",
  "size": 24576,
  "createdAt": "2026-09-03T10:00:00.000Z"
}
```

### GET /api/attachments/:attachmentId/download

Downloads an attachment only when its ticket belongs to the selected requester.

### DELETE /api/attachments/:attachmentId

Deletes an attachment only when its ticket belongs to the selected requester.

Request headers:

```text
X-Requester-Id: 1
```

Success response `204` with no response body.

## 7. Error Response Format

Validation and safe application errors use this format:

```json
{
  "error": "A clear message for the user"
}
```

The API must not expose database errors, file paths, stack traces, or other internal server details.
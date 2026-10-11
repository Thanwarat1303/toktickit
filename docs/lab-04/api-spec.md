# Lab 4 API Contract

Extends Lab 3. Auth uses the existing session cookie and same-origin checks. Error order: 401, 403, 400, 404, 409. Validation errors use `{ error, errors }`; conflicts use `{ error, code, currentVersion }`.

## Actions Taken

| Method and route | Roles | Result |
|---|---|---|
| `GET /api/tickets/:id/actions` | owner Requester, IT Staff, Administrator | ordered actions; Requester is ownership-scoped |
| `POST /api/tickets/:id/actions` | IT Staff, Administrator | creates action and revision 1, 201 |
| `PATCH /api/tickets/:id/actions/:actionId` | IT Staff, Administrator | requires action `version`; updates current row and appends revision |
| `GET /api/tickets/:id/actions/:actionId/revisions` | IT Staff, Administrator | revisions oldest-first |

Create body: `actionAt?`, `description`, `result?`, `followUpRequired?`, `followUpNote?`, `attachmentNotes?`, `status?`, `assigneeId?`. Performer is ignored if supplied. Patch body contains any editable fields and required integer `version`.

Create returns 201; valid patch returns 200. Invalid fields/missing version return 400; a missing ticket/action or another Requester’s ticket returns 404; stale version, final action, closed ticket or resolved ticket with a new open action returns 409 (`STALE_VERSION`, `ACTION_FINAL`, `TICKET_CLOSED`, `TICKET_RESOLVED`).

## Ticket workflow extensions

`GET /api/staff/tickets/:id` returns `version`, `allowedTransitions` and `resolutionGate: { ok, unmet }`.

`PATCH /api/staff/tickets/:id/status` is the **only** route that changes `currentStatus`. It requires `{ currentStatus, confirm?, version }`. It returns the updated ticket/version/gate, 400 for invalid body, 409 for `ILLEGAL_TRANSITION`, `RESOLUTION_GATE` or `STALE_VERSION`.

`PATCH /api/staff/tickets/:id/workflow` is retained for Lab 3 compatibility but is now **IT-priority only**: its body is exactly `{ "itPriority": "Low"|"Medium"|"High"|"Urgent", "version": number }`. Supplying `status` or `confirm` to this route is `400` at `errors.status` / `errors.confirm`; it never changes `currentStatus`. Existing claim, assign, this priority route and mark-resolved require a current ticket `version`, return the incremented version, and return 400/409 for missing/stale versions. Comments and notes remain append-only and unversioned.

## Dashboards

| Route | Roles | Contents |
|---|---|---|
| `GET /api/dashboard/requester` | Requester | own totals, waiting, recent, recently resolved |
| `GET /api/dashboard/staff` | IT Staff, Administrator | queue metrics, recent tickets, open actions assigned to caller, caller’s recent actions; Administrator also gets user counts |

All dashboard lists are at most five items unless a drill-down route is requested. A queue drill-down uses `actionAssigneeId=me` and returns the same distinct ticket set as `ticketsWithMyOpenActions`.

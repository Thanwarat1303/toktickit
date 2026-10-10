# Lab 4 UI Specification

## Navigation

Requester: Dashboard, New Ticket, My Tickets. IT Staff: Dashboard, Ticket Queue. Administrator: Dashboard, Ticket Queue, User Management. Active navigation uses `aria-current`.

## Actions Taken on Ticket Detail

The section lists actions by action time. Each entry shows status, performer, assignee, description, result, follow-up and attachment notes. Requesters see the same approved fields read-only. IT Staff/Admin see Add action; non-final entries have Edit and History. History expands immutable revisions oldest-first.

Create/edit is an inline labelled form. Description is required; enabling Follow-up makes its note required; Completed makes Result required. Save is disabled while submitting. Field errors appear next to their field. A stale version shows a conflict banner without discarding typed values. There is no Delete action.

## Workflow

Status controls display only API-provided transitions. RESOLVED remains visible but disabled with unmet reasons when the gate fails. Confirming a final ticket transition is explicit. Successful writes refresh status, versions, transitions and gate. The existing visual language remains Zen Green with text on badges and visible focus states.

## Dashboards

Metric cards have label, number and accessible View link. Staff/Admin show unassigned, assigned-to-me, open-actions-assigned-to-me, status/priority and recent tickets; “My recent actions” is performer-based. Requesters only see their own totals, waiting, recent and recently-resolved tickets. Empty, loading, error/Retry and forbidden states are explicit.

## Responsive/accessibility

At 1280, 768 and 375 px, cards reflow, controls retain labels, tables use an accessible responsive layout, and there is no page horizontal overflow, clipped controls or overlap. Keyboard access, visible focus, semantic labels, non-colour cues and WCAG 4.5:1 text contrast are required.

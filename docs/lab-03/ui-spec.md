# Lab 3 UI Specification

## Shared Zen Green Rules

Reuse Lab 2 tokens, cards, buttons, badges, validation placement, focus states, and responsive behavior. Primary green is `#006B3C`, secondary green is `#0B7A46`, pale green is `#EAF6EF`, page background is `#F5F7F6`, text is dark charcoal-green, read-only fields use soft gray-green, and errors use dark red.

The application shell displays the authenticated user's name and role, a Logout action, and only role-permitted navigation. Every screen has visible loading, saving, validation, success, empty/no-results, forbidden, not-found, conflict, and safe failure feedback where meaningful. Tables must reflow into readable cards or stacked rows on smaller screens without horizontal overflow.

## Login and Change Password

Login contains email, password, validation, busy submit state, and safe failure feedback. Inactive-account errors do not reveal unnecessary account information. A mandatory Change Password screen contains current password, new password, confirmation, password rules, validation, busy state, and success continuation. Normal navigation is unavailable until the change succeeds.

## Requester Screens

Remove the Development Requester selector and Change Requester action. The authenticated Requester identity appears in the shell. Preserve Lab 2 Create Ticket, My Tickets, Ticket Detail, Attachment, and soft-remove behaviors. Add Public Comments and a clearly labelled `Problem Appears Resolved` action. Requesters never see Internal Notes or IT Staff controls.

## IT Staff Ticket Queue

Provide search, suitable filters, sorting, pagination, status/priority/owner badges, an open-detail action, and clear assigned/unassigned values. The desktop view may use a table; tablet/mobile views should use stacked ticket cards with the same essential fields. Include loading, empty, no-results, forbidden, and failure states.

## IT Staff Ticket Detail

Group read-only ticket information separately from editable operational fields. Provide owner claim/reassign, IT Priority, permitted status controls, existing attachments, Public Comments, and Internal Notes. Public and private communication must use distinct headings, colors, and controls. Show Requester resolution indication without allowing Requester-only actions to become formal status changes.

## Administrator User Management

Use one intentionally simple responsive screen. The list shows Name, Email, Role, Status, and Edit. Provide name/email search, optional role filter, create form, edit form, role selection, activation state, initial-password action, and clear validation/conflict/forbidden/success feedback. Do not add deletion, bulk operations, or advanced account-management UI.

## Accessibility and Evidence Checklist

All controls have labels, keyboard focus is visible, errors are associated with fields, buttons expose busy/disabled states, text has readable contrast, and mobile views do not clip or overlap. Capture desktop, tablet, and mobile screenshots for Login, Change Password, IT Staff Queue, IT Staff Ticket Detail, and User Management.

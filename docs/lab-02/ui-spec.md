# Lab 2 UI Specification

## 1. Design Goal

The TokTickIT interface should feel clean, calm, and easy to use. A requester should understand what to do without needing technical knowledge.

The design should use a green IT service desk theme with clear forms, readable text, and helpful feedback messages.

## 2. Visual Style

Lab 2 uses the required Zen Green Theme.

Color tokens:

- Primary green: `#006B3C` for the application header, primary actions, and strong emphasis.
- Secondary green: `#0B7A46` for active navigation, focus accents, links, and hover states.
- Pale green: `#EAF6EF` for selected states, success messages, and subtle section emphasis.
- Page background: `#F5F7F6` or a similarly quiet near-white.
- Surface and cards: white with a subtle border and restrained shadow.
- Main text: dark charcoal-green, not pure black.
- Editable fields: white background with a clear neutral border.
- Read-only fields: soft gray-green or warm ivory shading that is clearly different from editable fields.
- Error state: dark red text and border, with the message directly below the related field.
- Warning state: amber may be used only for warnings, not as ordinary decoration.
- Success state: green confirmation with readable text and a non-color indicator where possible.

General component rules:

- Use Bootstrap components where appropriate.
- Use consistent spacing, labels above controls, and clear button text.
- Required fields show a red asterisk and a validation message near the field.
- Use responsive layouts that become one column on small screens.
- Keep visible keyboard focus indicators and clear disabled or busy button states.
## 3. Shared Layout

Every page should include:

- Application title: `TokTickIT IT Service Desk`
- Current selected requester display
- Navigation links for `Create Ticket` and `My Tickets`
- A requester selector or a clear way to change the selected requester
- Loading, empty, and error states where needed

## 4. Development Requester Selection

Purpose: choose the current requester for local testing.

The page or selector should show:

- A dropdown containing active requesters
- Requester name and email
- A confirmation or visible selected state after changing the requester

Rules:

- Inactive requesters must not appear.
- The user should be told to select a requester before using ticket features.

## 5. Create Ticket Page

The page should contain a clear heading such as:

```text
Create an IT Support Ticket
```

Form fields:

- Category dropdown
- Related System dropdown
- Summary text input
- Description text area
- Priority selection: Low, Medium, High
- Submit button: `Create Ticket`

Expected behaviour:

- Required fields are clearly marked.
- Invalid fields show helpful messages below the field.
- The submit button is disabled or shows a busy state while submitting.
- On success, show the ticket number and a button or link to view ticket details.
- On failure, show a clear error message without removing the user's entered data.

## 6. My Tickets Page

The page should contain:

- Page heading: `My Tickets`
- Search input for ticket number or summary
- Filters for status, category, related system, and priority
- Sort controls
- Ticket table or responsive ticket cards
- Pagination controls
- Empty state when the requester has no tickets

Each ticket item should show:

- Ticket number
- Summary
- Priority
- Status
- Category
- Related system
- Created date

Clicking a ticket opens its Ticket Detail page.

## 7. Ticket Detail Page

The page should show:

- Ticket number and status badge
- Summary
- Description
- Requester information
- Category and related system
- Priority
- Created date
- Attachment section

The attachment section should allow the ticket owner to:

- Select a file
- Upload the file
- View file name and size
- Download an attachment
- Delete an attachment after confirmation

## 8. Required UI States

The interface must handle these states clearly:

- Loading: show a spinner or loading message.
- Empty: explain that there are no tickets or attachments yet.
- Validation error: show the error next to the relevant field.
- API error: show a safe, friendly error message.
- Offline or unavailable backend: explain that the API cannot be reached.
- Unauthorized ticket access: show a not found or access denied message without exposing another requester's data.

## 9. Accessibility Notes

- Form labels must be associated with inputs.
- Buttons must have clear text.
- Color must not be the only way to communicate an error or status.
- Text and background colors must have readable contrast.
- Keyboard users must be able to reach form controls and buttons.
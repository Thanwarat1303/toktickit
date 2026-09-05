# Lab 2 AI Use Record

## Purpose of AI Use

I used AI as a learning assistant during Lab 2. It helped me understand the lab requirements, break the work into smaller issues, plan documentation, and explain GitHub workflow in simple language.

I did not use AI output without checking it. I compared the suggestions with the lab sheet, decided which parts matched the required scope, and edited the documents and code plan myself.

## AI Tool Used

- ChatGPT / Codex

## Record 1 — Understanding the Lab Scope

### Prompt

> Please explain the Lab 2 requirements in simple language for a third-year student. Help me separate the work into issues and explain the required GitHub workflow.

### How AI Helped

AI helped explain that the lab should be divided into smaller features, each feature should use a branch and pull request, and the work should be tracked in the GitHub Project board.

### My Own Decision and Verification

I checked the lab sheet and created my own Lab 2 issues on the existing TokTickIT Individual Sprints board. I kept the required workflow:

```text
feature branch -> peer-reviewed PR -> lab2-staging -> release PR -> main
```

I also decided to use Issue #11 for engineering documents before implementation.

## Record 2 — Writing the Engineering Specification

### Prompt

> Help me create a simple engineering specification for a requester-facing IT support ticketing system. Include the goal, scope, functional requirements, business rules, data changes, API contract summary, acceptance criteria, and definition of done.

### How AI Helped

AI suggested a document structure and examples of functional requirements and business rules.

### My Own Decision and Verification

I checked each requirement against the Lab 2 sheet. I kept the required features such as development requester selection, ticket creation, My Tickets, ticket detail, attachments, ownership protection, tests, and peer review.

I chose to exclude real authentication, staff workflow, email notifications, and production deployment because they are outside the Lab 2 scope.

## Record 3 — API Planning

### Prompt

> Help me describe API endpoints for active reference data, ticket creation, ticket list, ticket detail, and attachments. Keep the API safe and make sure requesters can access only their own tickets.

### How AI Helped

AI suggested a consistent API structure and safe error responses.

### My Own Decision and Verification

I decided that the selected development requester ID will be sent as `X-Requester-Id` during local testing. I will verify this design against the provided starter code and automated tests before implementing the backend.

## Record 4 — Development Requester Selection

### Prompt

> Help me implement Issue #13 according to the Lab 2 specification. Add an API that returns only active Development Requesters, build a separate requester-selection screen, remember the selected requester, support changing requester, keep the Lab 1 behaviour working, use the Zen Green visual style, and add backend and frontend tests.

### How AI Helped

AI helped draft the API route, React requester selector, loading and error states, local storage behaviour, responsive styling, and automated tests. It also helped diagnose tests that selected ambiguous elements after the UI gained additional headings and labels.

### My Own Decision and Verification

I kept requester selection separate from ticket creation because Lab 2 uses the selected requester as a temporary development identity. I verified that the API excludes inactive requesters, the selected requester remains active after a page reload, and the user can clear it with **Change requester**. I ran the backend and frontend tests and both production builds before preparing the pull request.

## Record 5 — Create Ticket API

### Prompt

> Help me implement the Create Ticket API for Lab 2. It must use the selected development requester in `X-Requester-Id`, validate all ticket fields, reject inactive reference data, create a backend-generated ticket number with status `New`, prevent rapid duplicate submissions, and include API tests.

### How AI Helped

AI helped break the route into validation, reference-data checks, duplicate detection, ticket creation, response formatting, and test cases.

### My Own Decision and Verification

I used the Lab 2 API contract to keep the requester identity in the header rather than the request body. I chose a 60-second duplicate window and documented it in the API contract. I kept the public ticket number generated on the backend from the database ID so the frontend cannot choose it. I will run the server tests and TypeScript build locally before opening the Feature 14 pull request.

## Reflection

AI was useful for explaining unfamiliar concepts and organizing my work. However, I still need to understand the code, test every feature, read reviewer comments, and make the final implementation decisions myself.

I will update this file when AI is used again for later Lab 2 tasks, including database design, API implementation, frontend implementation, debugging, and testing.

## Record 6 — Create Ticket UI

### Prompt

> Help me implement Issue #15: a Create Ticket form that follows the Lab 2 UI specification, validates required fields, loads active reference data, sends the selected requester ID to the API, keeps form data after an error, and shows the generated ticket number after success.

### How AI Helped

AI helped organize the React form into loading, validation, submitting, failure, and success states. It also identified that the form needs an active Related Systems lookup endpoint before the dropdown can work with real data.

### My Own Decision and Verification

I kept the backend as the final authority for validation and used client-side validation only to give faster feedback. I kept the selected requester read-only in the form because it comes from the Development Requester selector. I will run the frontend and backend tests, build both projects, and manually create a ticket before opening the pull request.

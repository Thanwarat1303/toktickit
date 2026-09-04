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

## Reflection

AI was useful for explaining unfamiliar concepts and organizing my work. However, I still need to understand the code, test every feature, read reviewer comments, and make the final implementation decisions myself.

I will update this file when AI is used again for later Lab 2 tasks, including database design, API implementation, frontend implementation, debugging, and testing.
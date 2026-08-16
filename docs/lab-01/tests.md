# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

## Test Summary

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET `/api/health` returns 200, status=ok | Passed |
| 2 | Supertest | GET `/api/categories` returns 4 seeded categories in id order | Passed |
| 3 | Vitest | Heading renders | Passed |
| 4 | Vitest | Success state shows Online + category list | Passed |
| 5 | Vitest | Error state shows Offline + message | Passed |

## Backend Test Evidence

Backend tests are located in:

- `server/tests/lab-01/health.test.ts`
- `server/tests/lab-01/categories.test.ts`

Command used:

```bash
cd server
npm test
```

Result:

```text
Test Files  2 passed (2)
Tests       2 passed (2)
```

The backend tests verify that:

1. `GET /api/health` returns HTTP 200 with the expected API health status.
2. `GET /api/categories` returns the four seeded IT request categories in id order.

The four seeded categories are:

- Account and Access
- Hardware
- Software
- Network

## Frontend Test Evidence

Frontend tests are located in:

- `client/tests/lab-01/App.test.tsx`

Command used:

```bash
cd client
npm test
```

Result:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
```

The frontend tests verify that:

1. The TokTickIT heading is displayed.
2. When the API request succeeds, the page displays the Online status and the seeded category list.
3. When the API is unavailable, the page displays the Offline status and an error message.

## Final Test Result

All required backend and frontend tests passed successfully.

- Backend: 2 tests passed
- Frontend: 3 tests passed
- Total: 5 tests passed

The final test evidence will also be included as screenshots in the Lab 1 submission PDF.
# TokTickIT

TokTickIT is a role-based IT service desk developed for CPE334. Labs 1–3 establish ticket submission, authentication, requester workspaces, IT Staff operations and Administrator user management. Lab 4 adds an auditable Actions Taken log, safe ticket workflow controls and per-role dashboards.

## Lab 4 deliverables

- **Actions Taken:** IT Staff and Administrators can create and update work records. Every accepted edit appends an immutable revision; Requesters can view actions only on their own tickets.
- **Safe workflow:** ticket changes use optimistic locking. The resolution gate requires an owner, at least one completed action and no planned/in-progress action before a ticket can be resolved.
- **Dashboards:** Requester, IT Staff and Administrator dashboards show role-scoped metrics and links to the matching filtered list.
- **Responsive UI:** Administrator navigation wraps at phone width; the Lab 4 navigation regression checks the three Administrator destinations at 375px.

The detailed contract and traceability are in [docs/lab-04/specification.md](docs/lab-04/specification.md), [docs/lab-04/api-spec.md](docs/lab-04/api-spec.md), [docs/lab-04/ui-spec.md](docs/lab-04/ui-spec.md) and [docs/lab-04/tests.md](docs/lab-04/tests.md).

## Technology

- Client: React, TypeScript, Vite and Bootstrap
- Server: Node.js, Express and TypeScript
- Database: PostgreSQL and Prisma
- Automated tests: Vitest, Supertest and Playwright

## Local setup

1. Start PostgreSQL (the default development port used by this project is `15433`).
2. Copy `server/.env.example` to `server/.env`, then set `DATABASE_URL` and `CLIENT_ORIGIN`. Do not commit `.env`.
3. Install dependencies in each package:

```powershell
cd server; npm ci
cd ..\client; npm ci
cd ..\e2e; npm ci
```

4. Apply migrations and seed deterministic development data:

```powershell
cd ..\server
npx prisma migrate deploy
npm run prisma:seed
```

The seed is idempotent. It creates categories, related systems, role accounts and tickets `TKT-SEED-001` through `TKT-SEED-012`, including Actions Taken data for Lab 4. Seeded accounts use the development initial password configured by `LAB3_INITIAL_PASSWORD` or its documented fallback. They must change it on first sign-in.

## Run the application

Start the server:

```powershell
cd server
npm run dev
```

Start the client in a second terminal:

```powershell
cd client
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

## Verification

Run the configured suites sequentially while the local server and client are available for Playwright:

```powershell
cd server; npm test; npm run build; npx prisma migrate status
cd ..\client; npm test; npm run build
cd ..\e2e; npm test
```

Post-merge verification on `main` commit `e211b14` (2026-11-02):

| Check | Result |
|---|---|
| Server Vitest | 22 files, 104/104 passed |
| Client Vitest | 10 files, 37/37 passed |
| Playwright | 6/6 passed |
| Server/client builds | passed |
| Prisma migration status | 8 migrations; schema up to date |

The Playwright suite includes the fresh-seed first-password-change flow and the 375px Administrator navigation-overflow regression. See [docs/lab-04/release-checklist.md](docs/lab-04/release-checklist.md) for the full verification record and [artifacts/lab-04/screenshots](artifacts/lab-04/screenshots) for visual evidence.

## Lab 4 evidence map

| Evidence | Location |
|---|---|
| Engineering contract | `docs/lab-04/specification.md` |
| API contract | `docs/lab-04/api-spec.md` |
| UI contract and screenshot checklist | `docs/lab-04/ui-spec.md` |
| Tests and traceability | `docs/lab-04/tests.md` |
| Release verification | `docs/lab-04/release-checklist.md` |
| Review history | `docs/lab-04/reviewer.md` |
| AI-use disclosure | `docs/lab-04/ai-use.md` |
| Screenshots | `artifacts/lab-04/screenshots/` |

## Deployment note

Authentication uses an HttpOnly, `SameSite=Strict` session cookie. Keep the client and API on the same site in production (for example via a reverse proxy) so authenticated requests and attachment downloads carry the cookie. Do not weaken the cookie to `SameSite=None` solely to connect unrelated sites.

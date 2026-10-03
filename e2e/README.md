# TokTickIT E2E tests

Start the API on port 3000 and the Vite client on port 5173, then run:

```powershell
cd e2e
npm install
npx playwright install chromium
npm test
```

`E2E_BASE_URL` may override the client URL. The initial authentication tests use
the documented development seed account and never submit a password change, so
they leave seed data unchanged. Stateful staff/admin flows will use dedicated
fixtures in the next commit.

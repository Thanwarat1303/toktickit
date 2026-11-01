# Lab 4 Final Release Checklist

This checklist is the final pass for issue #66. It records the evidence that must be present before the Lab 4 branch is merged to `main`.

## 1. Preconditions

- [ ] All Lab 4 implementation issues are merged into `lab4-staging`.
- [ ] The development database is migrated and seeded from a clean state.
- [ ] The fixture accounts are restored before the evidence run.
- [ ] The server and client use the same commit under test.

## 2. Automated regression

Run the suites sequentially against the configured development database:

```text
cd server && npm test
cd client && npm test
cd e2e && npm test
```

Record the final file/test totals in `tests.md`. The normal Playwright run must include the Lab 1–3 regression and all Lab 4 flows; an evidence-only suite must not be counted as the normal regression suite.

## 3. Lab 4 end-to-end coverage

- [ ] Actions Taken create, validation, edit and revision history.
- [ ] Inactive assignee validation keeps typed input and does not corrupt the action.
- [ ] Resolution gate, confirmation and optimistic-lock conflicts.
- [ ] Administrator ticket workflow, comments and internal notes.
- [ ] Requester read-only Actions Taken view.
- [ ] Dashboard numbers match independent database queries.
- [ ] Every dashboard drill-down opens the exact filtered list it counts.

## 4. Accessibility and responsive evidence

Run the checks at exactly **1280×900, 768×1024 and 375×812**.

- [ ] Keyboard-only flow reaches every control and shows the Zen Green focus ring.
- [ ] WCAG contrast is measured against the background actually drawn.
- [ ] Status, priority and follow-up state include text labels.
- [ ] No horizontal overflow, overlap, clipped select label or off-screen control.
- [ ] Staff, Administrator and Requester detail views are checked separately.
- [ ] Conflict banner and resolution-gate message are visible at mobile width.

Screenshots belong under:

```text
artifacts/lab-04/screenshots/
```

Use the names and checklist in `ui-spec.md` section 9. Tablet screenshots must be 768px wide; a cropped message image may be narrower only when it is explicitly documented as a crop.

## 5. Documentation and review

- [ ] `tests.md` Pass/Planned values match files that actually exist.
- [ ] `reviewer.md` contains only real GitHub review findings and resolutions.
- [ ] `ai-use.md` contains the student's own reflection and does not claim AI output as evidence.
- [ ] README includes the final test commands and seeded accounts.
- [ ] No TODO, FIXME, placeholder or debug logging remains in product code.
- [ ] The final `lab4-staging` → `main` pull request links the regression results, screenshots and reviewer records.

## 6. Final merge gate

- [ ] Working tree is clean except intentionally ignored generated output.
- [ ] Server and client builds pass with `tsc` enabled.
- [ ] Database migration status is up to date.
- [ ] The final PR has an independent review and approval before merge.

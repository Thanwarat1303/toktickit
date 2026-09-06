# Lab 2 Release Verification Checklist

## Purpose

This checklist records the final verification for Issue #18 before the release pull request is opened. A checkbox may be marked only after the student has run the command or observed the behaviour in the browser.

## 1. Automated Verification

- [x] `cd server; npm test` passes. Final count was verified locally in the terminal.
- [x] `cd server; npm run build` passes.
- [x] `cd client; npm test` passes. Final count was verified locally in the terminal.
- [x] `cd client; npm run build` passes.
- [ ] `git status` is clean except for intentional report or evidence files.

## 2. Manual Requester Flow

- [ ] The Development Requester selector shows active requesters only.
- [ ] A selected requester remains active when moving between New Ticket and My Tickets.
- [ ] A valid ticket can be created and displays its generated ticket number.
- [ ] Empty or invalid Create Ticket fields show clear field-level validation.
- [ ] My Tickets shows only the selected requester's tickets.
- [ ] Search, filters, sorting, pagination, and empty state work on My Tickets.
- [ ] Opening a ticket shows its ticket fields; Back returns to the preserved list state.

## 3. Attachment Evidence

- [ ] A permitted JPG, PNG, WEBP, or PDF at or below 5 MB uploads for the ticket owner.
- [ ] An unsupported file type or file over 5 MB is rejected with a clear message.
- [ ] The attachment count reaches at most five active files and the upload control is disabled at the limit.
- [ ] Attachment metadata is visible after upload and the file can be downloaded while active.
- [ ] Soft removal requires a reason, retains the metadata, and prevents later download.
- [ ] A second removal attempt is rejected without changing the original removal reason.

## 4. UI and Responsive Evidence

- [ ] Desktop screenshot: requester selection or New Ticket screen using the Zen Green theme.
- [ ] Desktop screenshot: My Tickets list with a ticket detail view.
- [ ] Screenshot: valid attachment upload result.
- [ ] Screenshot: invalid attachment validation result.
- [ ] Tablet-width screenshot has no clipping or unintended horizontal scroll.
- [ ] Mobile-width screenshot has no clipping or unintended horizontal scroll.

## 5. GitHub Release Evidence

- [ ] `reviewer.md` links to PRs #19 through #25 and records their merged status.
- [ ] Issue #18 has an open pull request from `feature/18-final-testing-release` to `lab2-staging`.
- [ ] A peer review is requested and any feedback is resolved before merge.
- [ ] The final PR description includes the actual test/build results and links to screenshot evidence or the report.

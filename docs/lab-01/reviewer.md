# Lab 1 — Peer Review Record

**Author:** Thanwarat Chantana — 67070501025 — GitHub: @Thanwarat1303  
**Peer reviewer:** Aphisamai Kulpaibutr — 67070501077 — GitHub: @mxckiexz

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| https://github.com/Thanwarat1303/toktickit/pull/5 | feature/1-project-foundation | Approved |
| https://github.com/Thanwarat1303/toktickit/pull/6 | feature/2-health-check | Approved |
| https://github.com/Thanwarat1303/toktickit/pull/7 | feature/3-category-seed | Approved |
| https://github.com/Thanwarat1303/toktickit/pull/8 | feature/4-category-list | Approved |

Reviewer comment I received:

For Issue 4, my reviewer checked the implementation against the acceptance criteria. The reviewer asked me to verify that the old `checkSystem not implemented yet` error had been removed from `client/src/api.ts`, because the UI tests mocked `checkSystem` and would not detect this issue directly. The reviewer also suggested removing unused stub code and adding additional error-case tests for better coverage.

How I responded:

I checked `client/src/api.ts` and confirmed that the old `throw new Error("checkSystem not implemented yet")` line had already been removed. The `checkSystem()` function now checks the API health, requests `/api/categories`, handles unsuccessful responses, and returns the categories from the API. I also ran the backend and frontend tests successfully before merging.

## Pull Requests I reviewed for my partner

Partner PR: https://github.com/mxckiexz/what-/pull/1

My comment:

Checked Issue 1 again. Everything looks good now, and the PR target has been changed to lab1-staging. Approved.

Partner's response:

My partner corrected the pull request target branch from `main` to `Lab01-/staging`. I reviewed Issue 1 again after the correction, confirmed that the project foundation requirements were satisfied, and approved the pull request.
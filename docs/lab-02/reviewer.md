# Lab 2 Peer Review Record

## My Information

- Author: Thanwarat Chantara
- GitHub username: Thanwarat1303

## Review Process

For each Lab 2 feature:

1. I create a feature branch from `lab2-staging`.
2. I implement and test the feature.
3. I open a pull request to `lab2-staging`.
4. I request a review from my peer.
5. If the reviewer requests changes, I fix the issue and push the update.
6. The reviewer approves the pull request.
7. The pull request is merged into `lab2-staging`.

## Pull Requests I Authored

| Issue | Feature branch | Pull request | Reviewer | Result |
| --- | --- | --- | --- | --- |
| #11 | `feature/11-lab2-contract` | [PR #19](https://github.com/Thanwarat1303/toktickit/pull/19) | mxckiexz | Approved and merged |
| #12 | `feature/12-data-seed` | [PR #20](https://github.com/Thanwarat1303/toktickit/pull/20) | mxckiexz | Approved and merged |
| #13 | `feature/13-requester-selection` | [PR #21](https://github.com/Thanwarat1303/toktickit/pull/21) | mxckiexz | Approved and merged |
| #14 | `feature/14-create-ticket-api` | To be added | mxckiexz | Implementation complete; awaiting PR |
| #15 | `feature/15-create-ticket-ui` | To be added | To be added | Not started |
| #16 | `feature/16-my-tickets` | To be added | To be added | Not started |
| #17 | `feature/17-ticket-detail-attachments` | To be added | To be added | Not started |
| #18 | `feature/18-final-testing-release` | To be added | To be added | Not started |

## Reviewer Comments and My Responses

### Issue #11 — Lab 2 Engineering Contract and Test Plan

Reviewer: mxckiexz

Reviewer comment:

> - Acceptance Criteria needs numbered IDs and explicit Given-When-Then format.  
> - tests.md needs a Planned-Test Table and an AC-to-test traceability matrix.  
> - Attachment removal must use soft removal, not hard delete.

My response:

> I updated the Acceptance Criteria with AC IDs and explicit Given-When-Then statements. I added a Planned-Test Table and an acceptance-criterion traceability matrix to tests.md. I also updated the specification, API contract, and UI specification to use attachment soft removal with retained metadata and a required removal reason.

Resolution:

> Changes completed. The reviewer approved the updated pull request, and PR #19 was merged into `lab2-staging`.

### Issue #13 — Development Requester Selection

Reviewer: mxckiexz

Reviewer comment:

> The colors in `client/src/styles.css` did not match the required Zen Green tokens documented in `ui-spec.md`: primary `#006B3C`, secondary `#0B7A46`, pale `#EAF6EF`, and page background `#F5F7F6`.

My response:

> I defined the required Zen Green colors as CSS custom properties and applied them consistently to the page background, header, buttons, accents, focus states, and selected or success states. Neutral, disabled, and error colors are still used for their intended UI states.

Resolution:

> Changes completed. Waiting for the reviewer to re-check the updated pull request.

## Pull Requests I Reviewed for My Peer

| Peer repository / pull request | What I checked | My review result |
| --- | --- | --- |
| To be added | To be added | To be added |

## Notes

- A review comment is not the same as approval. The reviewer must use the GitHub **Approve** option after checking the pull request.
- Review evidence, comments, requested changes, and fixes will be kept in this file.

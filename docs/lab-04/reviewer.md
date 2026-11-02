# Lab 4 Peer Review Record

This record is derived from the GitHub review history for `Thanwarat1303/toktickit` PRs #67–#78. It records actual reviewer states and author responses; an approval is not inferred merely because a PR was merged.

| PR | Reviewer | Material finding / review state | Resolution recorded in GitHub | Final GitHub review state |
|---|---|---|---|---|
| [#67](https://github.com/Thanwarat1303/toktickit/pull/67) Engineering contract | mxckiexz | Requested the contract state whether the old `/workflow` route remains or is replaced by `/status`. | `bdefa13`: `/workflow` documented as IT-priority only; status has a dedicated route. | Approved |
| [#68](https://github.com/Thanwarat1303/toktickit/pull/68) Data, migration and seed | mxckiexz | No material finding recorded. | Migration and seed merged as reviewed. | Approved |
| [#69](https://github.com/Thanwarat1303/toktickit/pull/69) Actions create/list API | mxckiexz | No material finding recorded. | API merged as reviewed. | Approved |
| [#70](https://github.com/Thanwarat1303/toktickit/pull/70) Action editing/history | mxckiexz | A deactivated existing assignee blocked edits that did not change `assigneeId`. | `8281031`: validate an assignee only when the request explicitly supplies one; regression test added. | Approved |
| [#71](https://github.com/Thanwarat1303/toktickit/pull/71) Optimistic locking | mxckiexz | Failed ticket mutation left the client with a stale ticket version. | `9d5bd4b`: reload ticket after failed mutation and add stale-version regression coverage. | Changes requested recorded; no later approval recorded |
| [#72](https://github.com/Thanwarat1303/toktickit/pull/72) Resolution workflow | mxckiexz | Administrator UI access, owner-validation order, attachment access, race coverage and resolved-ticket owner handling required correction. | `f95af87` and `42bdef2`: Administrator workspace, validation precedence, workflow/race coverage and owner restrictions updated. | Changes requested recorded; no later approval recorded |
| [#73](https://github.com/Thanwarat1303/toktickit/pull/73) Dashboard API | mxckiexz | Staff dashboard returned 500 because PostgreSQL enum values were compared as text; drill-down action-assignee set also needed an open-ticket rule. | `144fa56`: explicit enum cast, authenticated dashboard test and aligned filtering. | Changes requested recorded; no later approval recorded |
| [#74](https://github.com/Thanwarat1303/toktickit/pull/74) Requester dashboard API | mxckiexz | No material finding recorded. | Requester metrics/authorization coverage merged as reviewed. | Approved |
| [#75](https://github.com/Thanwarat1303/toktickit/pull/75) Dashboard UI and drill-down | mxckiexz | Boolean query values were serialised as `true`, while the API requires `1`. | `215241e`: boolean query serialisation fixed in both ticket-list clients; regression tests added. | Changes requested recorded; no later approval recorded |
| [#76](https://github.com/Thanwarat1303/toktickit/pull/76) Actions Taken UI | mxckiexz | UI always sent the existing `assigneeId`; a Resolved ticket visually showed Completed while state still held Planned. | `2f175dd`: PATCH sends changed fields only and Resolved creation defaults to Completed. | Changes requested recorded; no later approval recorded |
| [#77](https://github.com/Thanwarat1303/toktickit/pull/77) Final regression/responsive | mxckiexz | Administrator navigation overflowed at 375px; the fresh-seed test used the wrong password flow and a non-exact locator. | `15bc8ba`, `18ac9f4`, `c730300`: navigation wrap, fresh-seed password change, exact New password locator and regression rerun. | Changes requested recorded; no later approval recorded |
| [#78](https://github.com/Thanwarat1303/toktickit/pull/78) Lab 4 release to main | — | Release merge. | Merged to `main` as commit `e211b14`. | No review record returned by GitHub |

## Review conclusion

The record distinguishes a merged PR from an approved PR. Every material finding above has a linked author response and resolving commit in the GitHub history. The post-merge test results are recorded separately in `release-checklist.md` section 8.

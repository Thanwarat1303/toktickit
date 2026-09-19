# Lab 3 AI Use Record

## Tools Used

- OpenAI Codex was used as the specification and coding assistant.
- GitHub and the local repository remain the source of truth for Issues, Pull Requests, tests, and final evidence.

## Representative Prompts

1. Summarize the Lab 3 handout and identify the required roles, APIs, screens, tests, and evidence.
2. Decompose Lab 3 into reviewable GitHub Issues without dropping handout requirements.
3. Draft an engineering contract with numbered FR/BR items, an authorization matrix, a status-transition matrix, Given-When-Then acceptance criteria, and a Product Definition of Done.
4. Review authentication and session decisions for password safety, expiry, login-attempt handling, CSRF mitigation, and safe errors.
5. Build a planned-test table and AC-to-test traceability matrix covering API, UI, authorization, migration, responsive, and E2E tests.
6. Review implementation changes against the approved contract and identify missing evidence before merge.

## My Reflection

I used specification mode to turn the handout into explicit decisions before implementation. Separating role permissions and ownership rules from UI visibility was especially useful because hiding a button is not backend authorization. I used coding assistance for implementation guidance and test design, then checked the generated work against the repository, test output, and peer review rather than treating an agent response as evidence by itself. I kept session expiry, login-attempt protection, and CSRF behavior visible in the contract so the reviewer can approve or request changes before coding.

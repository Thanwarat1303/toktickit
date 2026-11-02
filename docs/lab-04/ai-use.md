# Lab 4 AI Use

**Tool used:** OpenAI Codex (GPT-5 family) through the Codex desktop application.

## How I used it

I used Codex as a discussion and review assistant during Lab 4. It helped me organise the specification, break the work into issues, inspect implementation ideas, suggest edge cases for tests, and explain Git, Prisma and debugging steps. It was also useful when I needed to compare a reviewer finding with the relevant business rule before deciding what to change.

## Specification work

For the specification, I used it to discuss the Actions Taken data model, the authorization matrix, the resolution gate, ticket/action versioning and the status-transition rules. For example, it helped turn the requirement “a resolved ticket must not have open work” into testable cases for create, edit and status-change flows.

I did not copy the suggestions blindly. I compared them with the lab sheet, the existing Lab 3 behaviour and the peer-review comments. One example was the old `/workflow` endpoint: the final contract keeps it for IT priority only and uses a separate `/status` route, because this was clearer than allowing two endpoints to change the same status.

## Implementation and testing work

For implementation, I used Codex to help trace risks in migration/seed changes, role middleware, stale-version handling, dashboard filters, Actions Taken forms and responsive layout. The suggestions were treated as proposals. I checked changes by reading the diff, running server/client/Playwright tests, testing the relevant screen locally and responding to actual GitHub review findings.

Examples of issues caught through that process were:

- an inactive previous assignee should not block an edit that does not change the assignee;
- dashboard boolean filters must be sent as `open=1` / `recent=1`, not `true`;
- Administrator navigation needed to wrap at 375px;
- the fresh-seed browser test had to handle the mandatory first-password-change screen and use an exact locator.

## My reflection

สำหรับแลปนี้ AI ช่วยให้ผมคิดเป็นระบบมากขึ้น โดยเฉพาะตอนแตก requirement ใหญ่ ๆ ออกเป็น business rule, test case และงานย่อยในบอร์ด ผมใช้มันช่วยถามเรื่อง optimistic locking, resolution gate, role permission และวิธีไล่หาสาเหตุเวลา test พัง แต่ผมไม่ได้เอาคำตอบมาใช้ทันที เพราะบางครั้งคำแนะนำยังไม่ตรงกับโค้ดเดิมหรือใบงาน

สิ่งที่ผมทำเองคืออ่านใบงาน เทียบกับโค้ดที่มีอยู่ ดู PR diff และอ่าน comment จากเพื่อนทีละจุดก่อนแก้ จากนั้นรัน test/build และลองหน้าเว็บจริง ถ้าผลไม่ตรงก็แก้และให้เพื่อนตรวจอีกครั้ง เช่น บั๊ก filter ของ dashboard กับบั๊ก navigation ล้นบนมือถือเป็นเรื่องที่ review เจอ แล้วผมแก้ตามหลักฐานที่ทดสอบซ้ำได้

สุดท้ายการตัดสินใจว่าอะไรจะอยู่ในระบบและอะไรจะเขียนในเอกสารเป็นของผมเอง AI ไม่ถือเป็นหลักฐานแทน test หรือแทนการ review ของเพื่อน หลักฐานที่ใช้ส่งจึงเป็นโค้ดที่ merge แล้ว, ผล test บน `main`, screenshot ที่เก็บใน repository และประวัติ PR จริงบน GitHub.

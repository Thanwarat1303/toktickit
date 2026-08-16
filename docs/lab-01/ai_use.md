# Lab 1 — AI Use and Reflection

**LLM/agent used:** ChatGPT (GPT-5.6 Sol)

## Selected key prompts

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | How should I start Issue 1 and set up the frontend, backend, PostgreSQL, and Prisma? | I used the answer to understand what I needed to set up first, then checked the files and tried running both frontend and backend by myself. |
| 2 | How do I create the `/api/health` endpoint for Issue 2? | I followed the idea from the answer and compared it with the acceptance criteria before editing `app.ts`. After that, I tested the endpoint to make sure the response was correct. |
| 3 | How do I test the health endpoint with Supertest? | I used the example as a guide for the test structure and then ran `npm test` to check that it actually passed. |
| 4 | What should I add to `schema.prisma` and `seed.ts` for Issue 3? | I sent the existing files first and used the answer to know what needed to be added. I then created the Category model and the four required categories. |
| 5 | How can I run the seed more than once without creating duplicate categories? | The answer suggested using Prisma `upsert`. I tried running the seed twice and checked that it finished successfully both times. |
| 6 | How do I create `GET /api/categories` and return the categories in ID order? | I used the suggested Prisma query as a guide, added the route, and tested it with Supertest. |
| 7 | How do I show the categories from the API in React with loading and error states? | I updated `api.ts` and `App.tsx` based on the existing project structure, then opened the page in the browser to check the result. |
| 8 | My reviewer said `checkSystem not implemented yet` might still be in `api.ts`. How can I check it? | I opened the real file and checked it myself. The old line had already been removed, so I did not change the code unnecessarily. I also ran the tests again before merging. |

## Reflection
ตอนแรกหนูใช้ chatgptโดยถามค่อนข้างกว้างดลยค่ะ ทำให้บางครั้งคำตอบที่ได้ยังไม่ตรงกับงานที่กำลังทำ หลัง ๆ เลยลองส่งรายละเอียดเพิ่ม เช่น Acceptance Criteriaโค้ดที่มีอยู่ และ error ที่ขึ้นในเทอมินอล ทำให้แชทจีพีทีเข้าใจปัญหามากขึ้นและแนะนำได้ตรงจุดกว่าเดิมเวลาที่แนะนำอะไรมาหนูก็ไม่ได้เอาไปใช้ทันทีทุกครั้ง แต่จะลองเปิดไฟล์เช็กและรันโปรแกรมหรือเทสดูก่อนว่าถูกจริงไหม อย่างตอน Issue 4 ที่มีการทักว่า checkSystem not implemented yet อาจจะยังอยู่ในโค้ด หนูก็กลับไปเปิด client/src/api.tsเช็กเอง แล้วก็เห็นว่าบรรทัดนั้นถูกลบไปแล้ว เลยไม่ได้แก้โค้ดเพิ่ม จาก Lab นี้หนูรู้สึกว่า AI ช่วยได้เยอะในเรื่องการอธิบายขั้นตอนและช่วยหาจุดที่ควรตรวจสอบ แต่สุดท้ายเราเองยังต้องเข้าใจว่าโค้ดกำลังทำอะไรและต้องเช็กผลด้วยตัวเอง ไม่ควรเชื่อเอไอทั้งหมดค่ะ
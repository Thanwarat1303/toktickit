import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma(); const marker = `ADMIN-USERS-${Date.now()}`; const password = "AdminFixture123!"; const origin = "http://localhost:5173";
let adminId: number; let requesterId: number; let adminAgent: request.Agent; let requesterAgent: request.Agent; let csrf: string; const createdIds: number[] = [];
async function login(email: string) { const agent = request.agent(app); const result = await agent.post("/api/auth/login").send({ email, password }).expect(200); return { agent, csrf: result.body.csrfToken as string }; }
beforeAll(async () => { const passwordHash = await hashPassword(password); const [admin, requester] = await Promise.all([
  prisma.user.create({ data: { name: "Management Admin", email: `${marker.toLowerCase()}-admin@example.test`, role: "ADMINISTRATOR", passwordHash, mustChangePassword: false } }),
  prisma.user.create({ data: { name: "Management Requester", email: `${marker.toLowerCase()}-requester@example.test`, role: "REQUESTER", passwordHash, mustChangePassword: false } }),
]); adminId = admin.id; requesterId = requester.id; const [a, r] = await Promise.all([login(admin.email), login(requester.email)]); adminAgent = a.agent; csrf = a.csrf; requesterAgent = r.agent; });
afterAll(async () => { await prisma.session.deleteMany({ where: { userId: { in: [adminId, requesterId, ...createdIds] } } }); await prisma.requester.deleteMany({ where: { userId: { in: createdIds } } }); await prisma.user.deleteMany({ where: { id: { in: [adminId, requesterId, ...createdIds] } } }); await prisma.$disconnect(); });
const post = (body: Record<string, unknown>) => adminAgent.post("/api/admin/users").set("Origin", origin).set("X-CSRF-Token", csrf).send(body);

describe("Administrator user management", () => {
  it("API-17: restricts the safe list to Administrators and supports search and role filtering", async () => {
    await request(app).get("/api/admin/users").expect(401); await requesterAgent.get("/api/admin/users").expect(403);
    const response = await adminAgent.get(`/api/admin/users?search=${encodeURIComponent("Management Admin")}&role=ADMINISTRATOR`).expect(200);
    expect(response.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: adminId, role: "ADMINISTRATOR" })])); expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    await adminAgent.get("/api/admin/users?role=NOPE").expect(400);
  });
  it("API-18: creates a one-role account, requester profile, and updates safe fields", async () => {
    const created = await post({ name: "New Requester", email: `${marker.toLowerCase()}-new@example.test`, role: "REQUESTER", isActive: true, initialPassword: "InitialPass123!" }).expect(201); createdIds.push(created.body.id);
    expect(created.body).toMatchObject({ role: "REQUESTER", mustChangePassword: true }); expect(await prisma.requester.findUnique({ where: { userId: created.body.id } })).not.toBeNull();
    await adminAgent.patch(`/api/admin/users/${created.body.id}`).set("Origin", origin).set("X-CSRF-Token", csrf).send({ name: "Updated Requester", isActive: false }).expect(200).expect((res) => expect(res.body).toMatchObject({ name: "Updated Requester", isActive: false }));
    await adminAgent.post(`/api/admin/users/${created.body.id}/initial-password`).set("Origin", origin).set("X-CSRF-Token", csrf).send({ initialPassword: "ResetPass123!" }).expect(200).expect((res) => expect(res.body.mustChangePassword).toBe(true));
  });
  it("API-19: rejects invalid input and case-insensitive duplicate emails", async () => {
    await post({ name: "", email: "no", role: "MULTI", isActive: "yes", initialPassword: "short" }).expect(400);
    const first = await post({ name: "Duplicate One", email: `${marker.toLowerCase()}-duplicate@example.test`, role: "IT_STAFF", isActive: true, initialPassword: "InitialPass123!" }).expect(201); createdIds.push(first.body.id);
    await post({ name: "Duplicate Two", email: `${marker.toUpperCase()}-DUPLICATE@EXAMPLE.TEST`, role: "IT_STAFF", isActive: true, initialPassword: "InitialPass123!" }).expect(409);
  });
  it("API-20: blocks self-deactivation and preserves the final active Administrator", async () => {
    await adminAgent.patch(`/api/admin/users/${adminId}`).set("Origin", origin).set("X-CSRF-Token", csrf).send({ isActive: false }).expect(409);
    // Seed Administrators are deliberately not part of this fixture.  Suspend
    // them only for this assertion, then restore their exact former states so
    // the test proves the global invariant without leaking state to later files.
    const otherAdmins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR", id: { not: adminId } }, select: { id: true, isActive: true } });
    try {
      await prisma.user.updateMany({ where: { id: { in: otherAdmins.map((user) => user.id) } }, data: { isActive: false } });
      await adminAgent.patch(`/api/admin/users/${adminId}`).set("Origin", origin).set("X-CSRF-Token", csrf).send({ role: "IT_STAFF" }).expect(409);
    } finally {
      await Promise.all(otherAdmins.map((user) => prisma.user.update({ where: { id: user.id }, data: { isActive: user.isActive } })));
    }
  });
});

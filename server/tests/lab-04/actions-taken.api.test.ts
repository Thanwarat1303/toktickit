import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const marker = `ACTIONS-${Date.now()}`;
const password = "ActionsTakenPass123!";
const origin = "http://localhost:5173";
let ticketId: number;
let otherTicketId: number;
let staffId: number;
let adminId: number;
let requesterId: number;
let requesterProfileId: number;
let otherRequesterId: number;
let otherRequesterProfileId: number;
let staff: request.Agent;
let admin: request.Agent;
let requester: request.Agent;
let otherRequester: request.Agent;
let staffCsrf: string;
let adminCsrf: string;

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password }).expect(200);
  return { agent, csrf: response.body.csrfToken as string };
}

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  const [staffUser, adminUser, requesterUser, otherRequesterUser, category, relatedSystem] = await Promise.all([
    prisma.user.create({ data: { name: "Action Staff", email: `${marker.toLowerCase()}-staff@example.test`, role: "IT_STAFF", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Action Admin", email: `${marker.toLowerCase()}-admin@example.test`, role: "ADMINISTRATOR", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Action Requester", email: `${marker.toLowerCase()}-requester@example.test`, role: "REQUESTER", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Other Requester", email: `${marker.toLowerCase()}-other@example.test`, role: "REQUESTER", passwordHash, mustChangePassword: false } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);
  staffId = staffUser.id; adminId = adminUser.id; requesterId = requesterUser.id; otherRequesterId = otherRequesterUser.id;
  const [profile, otherProfile] = await Promise.all([
    prisma.requester.create({ data: { userId: requesterUser.id, name: requesterUser.name, email: requesterUser.email } }),
    prisma.requester.create({ data: { userId: otherRequesterUser.id, name: otherRequesterUser.name, email: otherRequesterUser.email } }),
  ]);
  requesterProfileId = profile.id; otherRequesterProfileId = otherProfile.id;
  const [ticket, otherTicket] = await Promise.all([
    prisma.ticket.create({ data: { ticketNumber: `${marker}-OWN`, requesterId: profile.id, categoryId: category.id, relatedSystemId: relatedSystem.id, summary: "Own action fixture", description: "Fixture", priority: "MEDIUM", itPriority: "MEDIUM", currentStatus: "Open" } }),
    prisma.ticket.create({ data: { ticketNumber: `${marker}-OTHER`, requesterId: otherProfile.id, categoryId: category.id, relatedSystemId: relatedSystem.id, summary: "Other action fixture", description: "Fixture", priority: "MEDIUM", itPriority: "MEDIUM", currentStatus: "Open" } }),
  ]);
  ticketId = ticket.id; otherTicketId = otherTicket.id;
  const [staffLogin, adminLogin, requesterLogin, otherLogin] = await Promise.all([login(staffUser.email), login(adminUser.email), login(requesterUser.email), login(otherRequesterUser.email)]);
  staff = staffLogin.agent; staffCsrf = staffLogin.csrf; admin = adminLogin.agent; adminCsrf = adminLogin.csrf; requester = requesterLogin.agent; otherRequester = otherLogin.agent;
});

afterAll(async () => {
  await prisma.actionTakenRevision.deleteMany({ where: { actionTaken: { ticketId: { in: [ticketId, otherTicketId] } } } });
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: [ticketId, otherTicketId] } } });
  await prisma.ticket.deleteMany({ where: { id: { in: [ticketId, otherTicketId] } } });
  await prisma.session.deleteMany({ where: { userId: { in: [staffId, adminId, requesterId, otherRequesterId] } } });
  await prisma.requester.deleteMany({ where: { id: { in: [requesterProfileId, otherRequesterProfileId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [staffId, adminId, requesterId, otherRequesterId] } } });
  await prisma.$disconnect();
});

describe("Lab 4 Actions Taken create/list authorization", () => {
  it("API-01: creates revision 1 with the session user as performer", async () => {
    const response = await staff.post(`/api/tickets/${ticketId}/actions`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({
      performerId: adminId, description: "Replaced the docking station", status: "COMPLETED", result: "Dock works after test.", assigneeId: staffId,
    }).expect(201);
    expect(response.body).toMatchObject({ ticketId, performedBy: { id: staffId }, assignee: { id: staffId }, status: "COMPLETED", version: 1 });
    const revisions = await prisma.actionTakenRevision.findMany({ where: { actionTakenId: response.body.id } });
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({ revision: 1, editedById: staffId, status: "COMPLETED", result: "Dock works after test." });
  });

  it("API-02: stable list is requester-owned and readable by Staff/Admin", async () => {
    await staff.post(`/api/tickets/${ticketId}/actions`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ description: "Earlier action", actionAt: "2026-01-01T09:00:00.000Z" }).expect(201);
    await staff.post(`/api/tickets/${ticketId}/actions`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ description: "Later action", actionAt: "2026-01-01T09:00:00.000Z" }).expect(201);
    for (const agent of [requester, staff, admin]) {
      const response = await agent.get(`/api/tickets/${ticketId}/actions`).expect(200);
      expect(response.body.actions.map((action: { description: string }) => action.description)).toEqual(expect.arrayContaining(["Earlier action", "Later action"]));
      const tied = response.body.actions.filter((action: { actionAt: string }) => action.actionAt === "2026-01-01T09:00:00.000Z");
      expect(tied[0].id).toBeLessThan(tied[1].id);
    }
    await otherRequester.get(`/api/tickets/${ticketId}/actions`).expect(404);
  });

  it("API-02b: Administrator has the same action-create capability as IT Staff", async () => {
    const response = await admin.post(`/api/tickets/${ticketId}/actions`).set("Origin", origin).set("X-CSRF-Token", adminCsrf).send({
      description: "Administrator triage review", status: "PLANNED",
    }).expect(201);
    expect(response.body.performedBy).toMatchObject({ id: adminId, name: "Action Admin" });
  });

  it("API-03: denies unauthenticated and Requester writes without a row", async () => {
    const before = await prisma.actionTaken.count({ where: { ticketId } });
    await request(app).post(`/api/tickets/${ticketId}/actions`).send({ description: "No session" }).expect(401);
    await requester.post(`/api/tickets/${ticketId}/actions`).send({ description: "Requester cannot write" }).expect(403);
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(before);
  });

  it("API-04: returns field-level validation errors and preserves database state", async () => {
    const before = await prisma.actionTaken.count({ where: { ticketId } });
    const response = await staff.post(`/api/tickets/${ticketId}/actions`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({
      description: " ", status: "COMPLETED", result: "", followUpRequired: true, followUpNote: "", actionAt: "not-a-date", assigneeId: requesterId,
    }).expect(400);
    expect(response.body.errors).toMatchObject({ description: expect.any(String), result: expect.any(String), followUpNote: expect.any(String), actionAt: expect.any(String) });
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(before);
  });
});

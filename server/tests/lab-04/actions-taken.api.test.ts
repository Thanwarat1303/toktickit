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
  // A failed database connection means beforeAll never assigned fixture ids.
  // Keep cleanup from hiding that real setup failure with a second error.
  if (!ticketId || !otherTicketId) {
    await prisma.$disconnect();
    return;
  }
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

  it("API-09 and API-23: edits a non-final action with its current version and appends an immutable revision", async () => {
    const created = await staff.post(`/api/tickets/${ticketId}/actions`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({
      description: "Investigate intermittent VPN", assigneeId: staffId,
    }).expect(201);
    const updated = await staff.patch(`/api/tickets/${ticketId}/actions/${created.body.id}`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({
      version: 1, status: "IN_PROGRESS", description: "VPN logs are being reviewed", followUpRequired: true, followUpNote: "Contact requester after log review.",
    }).expect(200);
    expect(updated.body).toMatchObject({ id: created.body.id, version: 2, status: "IN_PROGRESS", description: "VPN logs are being reviewed" });

    const history = await staff.get(`/api/tickets/${ticketId}/actions/${created.body.id}/revisions`).expect(200);
    expect(history.body.revisions).toHaveLength(2);
    expect(history.body.revisions[0]).toMatchObject({ revision: 1, description: "Investigate intermittent VPN", status: "PLANNED" });
    expect(history.body.revisions[1]).toMatchObject({ revision: 2, editedBy: { id: staffId }, status: "IN_PROGRESS", followUpRequired: true });
  });

  it("API-10 and API-13: rejects a stale version and an invalid status move without changing action or history", async () => {
    const created = await staff.post(`/api/tickets/${ticketId}/actions`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ description: "Check DNS records" }).expect(201);
    await staff.patch(`/api/tickets/${ticketId}/actions/${created.body.id}`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ version: 1, status: "IN_PROGRESS" }).expect(200);
    const stale = await staff.patch(`/api/tickets/${ticketId}/actions/${created.body.id}`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ version: 1, description: "Stale overwrite" }).expect(409);
    expect(stale.body).toMatchObject({ code: "STALE_VERSION", currentVersion: 2 });
    const invalid = await staff.patch(`/api/tickets/${ticketId}/actions/${created.body.id}`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ version: 2, status: "PLANNED" }).expect(400);
    expect(invalid.body.errors.status).toEqual(expect.any(String));
    const action = await prisma.actionTaken.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(action).toMatchObject({ version: 2, status: "IN_PROGRESS", description: "Check DNS records" });
    expect(await prisma.actionTakenRevision.count({ where: { actionTakenId: created.body.id } })).toBe(2);
  });

  it("API-11 and API-14: validates the merged result and follow-up rules before writing", async () => {
    const created = await staff.post(`/api/tickets/${ticketId}/actions`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ description: "Replace damaged cable" }).expect(201);
    const response = await staff.patch(`/api/tickets/${ticketId}/actions/${created.body.id}`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({
      version: 1, status: "COMPLETED", result: "", followUpRequired: true, followUpNote: "",
    }).expect(400);
    expect(response.body.errors).toMatchObject({ result: expect.any(String), followUpNote: expect.any(String) });
    expect(await prisma.actionTakenRevision.count({ where: { actionTakenId: created.body.id } })).toBe(1);
  });

  it("API-12, API-15 and API-24: final actions cannot be edited or deleted, and Requesters cannot edit or view history", async () => {
    const created = await staff.post(`/api/tickets/${ticketId}/actions`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({
      description: "Completed replacement", status: "COMPLETED", result: "Replacement tested successfully.",
    }).expect(201);
    await staff.patch(`/api/tickets/${ticketId}/actions/${created.body.id}`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ version: 1, description: "Do not alter" }).expect(409);
    await staff.delete(`/api/tickets/${ticketId}/actions/${created.body.id}`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).expect(404);
    await requester.patch(`/api/tickets/${ticketId}/actions/${created.body.id}`).send({ version: 1, description: "Requester alteration" }).expect(403);
    await requester.get(`/api/tickets/${ticketId}/actions/${created.body.id}/revisions`).expect(403);
    expect(await prisma.actionTakenRevision.count({ where: { actionTakenId: created.body.id } })).toBe(1);
  });

  it("API-16: a resolved ticket rejects an edit that would leave an open action", async () => {
    const created = await staff.post(`/api/tickets/${ticketId}/actions`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ description: "Open work on resolved ticket" }).expect(201);
    await prisma.ticket.update({ where: { id: ticketId }, data: { currentStatus: "Resolved" } });
    try {
      const response = await staff.patch(`/api/tickets/${ticketId}/actions/${created.body.id}`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ version: 1, description: "Still open work" }).expect(409);
      expect(response.body.code).toBe("TICKET_RESOLVED");
      expect(await prisma.actionTakenRevision.count({ where: { actionTakenId: created.body.id } })).toBe(1);
    } finally {
      await prisma.ticket.update({ where: { id: ticketId }, data: { currentStatus: "Open" } });
    }
  });
});

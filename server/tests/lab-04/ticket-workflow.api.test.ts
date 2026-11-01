import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { ActionStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const marker = `LAB4-WORKFLOW-${Date.now()}`;
const password = "Lab4WorkflowFixture123!";
const origin = "http://localhost:5173";
let staffId: number;
let adminId: number;
let requesterUserId: number;
let requesterId: number;
let categoryId: number;
let relatedSystemId: number;
let staff: request.Agent;
let admin: request.Agent;
let staffCsrf: string;
let adminCsrf: string;
const ticketIds: number[] = [];

async function createTicket(input: { status?: string; ownerId?: number | null } = {}) {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `${marker}-${ticketIds.length + 1}`,
      requesterId,
      categoryId,
      relatedSystemId,
      summary: "Lab 4 workflow fixture",
      description: "Used to verify the resolution gate and status route.",
      priority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: input.status ?? "In Progress",
      assignedStaffId: input.ownerId === undefined ? staffId : input.ownerId,
    },
  });
  ticketIds.push(ticket.id);
  return ticket;
}

async function addAction(ticketId: number, status: ActionStatus) {
  return prisma.actionTaken.create({
    data: {
      ticketId,
      performedById: staffId,
      status,
      description: `Fixture ${status} action`,
      result: status === ActionStatus.COMPLETED ? "Completed work" : "",
    },
  });
}

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  const [staffUser, adminUser, requesterUser, category, relatedSystem] = await Promise.all([
    prisma.user.create({ data: { name: "Workflow Staff", email: `${marker.toLowerCase()}-staff@example.test`, role: "IT_STAFF", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Workflow Admin", email: `${marker.toLowerCase()}-admin@example.test`, role: "ADMINISTRATOR", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Workflow Requester", email: `${marker.toLowerCase()}-requester@example.test`, role: "REQUESTER", passwordHash, mustChangePassword: false } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);
  staffId = staffUser.id;
  adminId = adminUser.id;
  requesterUserId = requesterUser.id;
  categoryId = category.id;
  relatedSystemId = relatedSystem.id;
  requesterId = (await prisma.requester.create({ data: { userId: requesterUser.id, name: requesterUser.name, email: requesterUser.email } })).id;
  staff = request.agent(app);
  admin = request.agent(app);
  staffCsrf = (await staff.post("/api/auth/login").send({ email: staffUser.email, password }).expect(200)).body.csrfToken;
  adminCsrf = (await admin.post("/api/auth/login").send({ email: adminUser.email, password }).expect(200)).body.csrfToken;
});

afterAll(async () => {
  await prisma.actionTakenRevision.deleteMany({ where: { actionTaken: { ticketId: { in: ticketIds } } } });
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: [staffId, adminId, requesterUserId] } } });
  await prisma.requester.deleteMany({ where: { id: requesterId } });
  await prisma.user.deleteMany({ where: { id: { in: [staffId, adminId, requesterUserId] } } });
  await prisma.$disconnect();
});

describe("Lab 4 ticket status workflow", () => {
  it("blocks resolution until the owner and Action Taken gate both pass", async () => {
    const ticket = await createTicket({ ownerId: null });
    const blocked = await staff.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
      .send({ currentStatus: "Resolved", confirm: true, version: ticket.version }).expect(409);
    expect(blocked.body).toMatchObject({ code: "RESOLUTION_GATE", unmet: ["NO_OWNER", "NO_COMPLETED_ACTION"] });

    const owned = await prisma.ticket.update({ where: { id: ticket.id }, data: { assignedStaffId: staffId } });
    await addAction(ticket.id, ActionStatus.COMPLETED);
    const resolved = await staff.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
      .send({ currentStatus: "Resolved", confirm: true, version: owned.version }).expect(200);
    expect(resolved.body.ticket).toMatchObject({ id: ticket.id, status: "Resolved", version: owned.version + 1, resolutionGate: { ok: true, unmet: [] } });
  });

  it("separates priority and status writes and returns a clear illegal-transition conflict", async () => {
    const ticket = await createTicket({ status: "New" });
    await staff.patch(`/api/staff/tickets/${ticket.id}/workflow`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
      .send({ status: "Open", version: ticket.version }).expect(400)
      .expect((response) => expect(response.body.errors).toHaveProperty("status"));
    await staff.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
      .send({ currentStatus: "In Progress", version: ticket.version }).expect(409)
      .expect((response) => expect(response.body.code).toBe("ILLEGAL_TRANSITION"));
    await staff.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
      .send({ currentStatus: "Open", version: ticket.version }).expect(200);
  });

  it("allows an Administrator to claim and operate on the shared ticket queue", async () => {
    const ticket = await createTicket({ status: "New", ownerId: null });
    const claimed = await admin.post(`/api/staff/tickets/${ticket.id}/claim`).set("Origin", origin).set("X-CSRF-Token", adminCsrf)
      .send({ version: ticket.version }).expect(200);
    expect(claimed.body.owner).toMatchObject({ id: adminId, name: "Workflow Admin" });
    const detail = await admin.get(`/api/staff/tickets/${ticket.id}`).expect(200);
    expect(detail.body).toMatchObject({ version: ticket.version + 1, allowedTransitions: ["Open", "Cancelled"] });
  });
});

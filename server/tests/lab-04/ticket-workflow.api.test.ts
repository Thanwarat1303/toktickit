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

  it("reports OPEN_ACTIONS when completed and unfinished work coexist", async () => {
    const ticket = await createTicket({ ownerId: staffId });
    await addAction(ticket.id, ActionStatus.COMPLETED);
    await addAction(ticket.id, ActionStatus.PLANNED);

    const response = await staff.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
      .send({ currentStatus: "Resolved", confirm: true, version: ticket.version }).expect(409);
    expect(response.body).toMatchObject({ code: "RESOLUTION_GATE", unmet: ["OPEN_ACTIONS"] });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("In Progress");
  });

  it("requires confirmation for every confirmation-required transition", async () => {
    const cases = [
      { from: "In Progress", to: "Resolved" },
      { from: "Resolved", to: "Closed" },
      { from: "Closed", to: "Reopened" },
      { from: "New", to: "Cancelled" },
    ] as const;

    for (const entry of cases) {
      const ticket = await createTicket({ status: entry.from, ownerId: staffId });
      const response = await staff.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
        .send({ currentStatus: entry.to, version: ticket.version }).expect(400);
      expect(response.body.errors).toHaveProperty("confirm");
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe(entry.from);
    }
  });

  it("rejects a stale status write without changing the ticket", async () => {
    const ticket = await createTicket({ status: "New" });
    const current = await prisma.ticket.update({ where: { id: ticket.id }, data: { version: { increment: 1 } } });
    const response = await staff.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
      .send({ currentStatus: "Open", version: ticket.version }).expect(409);
    expect(response.body).toMatchObject({ code: "STALE_VERSION", currentVersion: current.version });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("New");
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

  it("allows an Administrator to claim, change status, and communicate on the shared ticket queue", async () => {
    const ticket = await createTicket({ status: "New", ownerId: null });
    const claimed = await admin.post(`/api/staff/tickets/${ticket.id}/claim`).set("Origin", origin).set("X-CSRF-Token", adminCsrf)
      .send({ version: ticket.version }).expect(200);
    expect(claimed.body.owner).toMatchObject({ id: adminId, name: "Workflow Admin" });
    const status = await admin.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).set("X-CSRF-Token", adminCsrf)
      .send({ currentStatus: "Open", version: claimed.body.version }).expect(200);
    expect(status.body.ticket).toMatchObject({ status: "Open", version: claimed.body.version + 1 });
    const comment = await admin.post(`/api/tickets/${ticket.id}/comments`).set("Origin", origin).set("X-CSRF-Token", adminCsrf)
      .send({ content: "Administrator public update" }).expect(201);
    const note = await admin.post(`/api/tickets/${ticket.id}/notes`).set("Origin", origin).set("X-CSRF-Token", adminCsrf)
      .send({ content: "Administrator internal note" }).expect(201);
    expect(comment.body.author).toMatchObject({ id: adminId, name: "Workflow Admin" });
    expect(note.body.author).toMatchObject({ id: adminId, name: "Workflow Admin" });
    const detail = await admin.get(`/api/staff/tickets/${ticket.id}`).expect(200);
    expect(detail.body).toMatchObject({ version: claimed.body.version + 1 });
    expect(detail.body.allowedTransitions).toEqual(expect.arrayContaining(["In Progress", "Cancelled"]));
  });

  it("serializes an Action Taken create and resolution without leaving resolved tickets with open work", async () => {
    for (let round = 0; round < 5; round += 1) {
      const ticket = await createTicket({ ownerId: staffId });
      await addAction(ticket.id, ActionStatus.COMPLETED);
      const [create, resolve] = await Promise.all([
        staff.post(`/api/tickets/${ticket.id}/actions`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
          .send({ description: `Concurrent planned action ${round}`, status: "PLANNED" }),
        staff.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
          .send({ currentStatus: "Resolved", confirm: true, version: ticket.version }),
      ]);
      if (create.status === 201) {
        expect(resolve.status).toBe(409);
        expect(resolve.body).toMatchObject({ code: "RESOLUTION_GATE", unmet: ["OPEN_ACTIONS"] });
      } else {
        expect(resolve.status).toBe(200);
        expect(create.body).toMatchObject({ code: "TICKET_RESOLVED" });
      }

      const finalTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const openActions = await prisma.actionTaken.count({ where: { ticketId: ticket.id, status: { in: [ActionStatus.PLANNED, ActionStatus.IN_PROGRESS] } } });
      expect(finalTicket.currentStatus !== "Resolved" || openActions === 0).toBe(true);
    }
  });

  it("requires reopening before a resolved ticket can be unassigned", async () => {
    const ticket = await createTicket({ ownerId: staffId });
    await addAction(ticket.id, ActionStatus.COMPLETED);
    const resolved = await staff.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
      .send({ currentStatus: "Resolved", confirm: true, version: ticket.version }).expect(200);
    const response = await staff.patch(`/api/staff/tickets/${ticket.id}/owner`).set("Origin", origin).set("X-CSRF-Token", staffCsrf)
      .send({ ownerId: null, version: resolved.body.ticket.version }).expect(409);
    expect(response.body).toMatchObject({ code: "RESOLUTION_GATE", unmet: ["NO_OWNER"] });
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, select: { currentStatus: true, assignedStaffId: true } })).toMatchObject({ currentStatus: "Resolved", assignedStaffId: staffId });
  });
});

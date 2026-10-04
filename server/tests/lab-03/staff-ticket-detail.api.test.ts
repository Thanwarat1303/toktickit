import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const marker = `STAFF-DETAIL-${Date.now()}`;
const password = "StaffDetailFixture123!";
const origin = "http://localhost:5173";
let ticketId: number;
let staffAId: number;
let staffBId: number;
let requesterUserId: number;
let inactiveStaffId: number;
let requesterProfileId: number;
let staffAgent: request.Agent;
let otherStaffAgent: request.Agent;
let requesterAgent: request.Agent;
let staffCsrfToken: string;
let otherStaffCsrfToken: string;

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  const [staffA, staffB, requester, inactiveStaff, category, relatedSystem] = await Promise.all([
    prisma.user.create({ data: { name: "Detail Staff A", email: `${marker.toLowerCase()}-staff-a@example.test`, role: "IT_STAFF", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Detail Staff B", email: `${marker.toLowerCase()}-staff-b@example.test`, role: "IT_STAFF", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Detail Requester", email: `${marker.toLowerCase()}-requester@example.test`, role: "REQUESTER", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Inactive Staff", email: `${marker.toLowerCase()}-inactive@example.test`, role: "IT_STAFF", passwordHash, isActive: false, mustChangePassword: false } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);
  staffAId = staffA.id;
  staffBId = staffB.id;
  requesterUserId = requester.id;
  inactiveStaffId = inactiveStaff.id;
  const requesterProfile = await prisma.requester.create({ data: { userId: requester.id, name: requester.name, email: requester.email } });
  requesterProfileId = requesterProfile.id;
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `${marker}-TICKET`, requesterId: requesterProfile.id, categoryId: category.id, relatedSystemId: relatedSystem.id,
      summary: `${marker} operational fixture`, description: "A ticket used to verify staff workflow operations.", priority: "MEDIUM", itPriority: "MEDIUM", currentStatus: "New",
    },
  });
  ticketId = ticket.id;

  staffAgent = request.agent(app);
  const staffLogin = await staffAgent.post("/api/auth/login").send({ email: staffA.email, password }).expect(200);
  staffCsrfToken = staffLogin.body.csrfToken;
  otherStaffAgent = request.agent(app);
  const otherStaffLogin = await otherStaffAgent.post("/api/auth/login").send({ email: staffB.email, password }).expect(200);
  otherStaffCsrfToken = otherStaffLogin.body.csrfToken;
  requesterAgent = request.agent(app);
  await requesterAgent.post("/api/auth/login").send({ email: requester.email, password }).expect(200);
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { id: ticketId } });
  await prisma.session.deleteMany({ where: { userId: { in: [staffAId, staffBId, requesterUserId, inactiveStaffId] } } });
  await prisma.requester.deleteMany({ where: { id: requesterProfileId } });
  await prisma.user.deleteMany({ where: { id: { in: [staffAId, staffBId, requesterUserId, inactiveStaffId] } } });
  await prisma.$disconnect();
});

describe("IT Staff ticket operations", () => {
  it("returns 404, without crashing, when staff posts a comment to a missing ticket", async () => {
    await staffAgent
      .post("/api/tickets/999999999/comments")
      .set("Origin", origin)
      .set("X-CSRF-Token", staffCsrfToken)
      .send({ content: "This must not create an orphan comment." })
      .expect(404);

    // Regression guard: the server remains available after the rejected FK target.
    await request(app).get("/api/health").expect(200);
  });

  it("returns the full staff detail only to authenticated IT Staff", async () => {
    await request(app).get(`/api/staff/tickets/${ticketId}`).expect(401);
    await requesterAgent.get(`/api/staff/tickets/${ticketId}`).expect(403);
    await staffAgent.get(`/api/staff/tickets/${ticketId}`).expect(200).expect((response) => {
      expect(response.body).toMatchObject({
        id: ticketId,
        ticketNumber: `${marker}-TICKET`,
        requester: { id: requesterProfileId, name: "Detail Requester" },
        priority: "Medium",
        itPriority: "Medium",
        status: "New",
        owner: null,
        publicComments: [],
        internalNotes: [],
        attachments: [],
      });
    });
    await staffAgent.get("/api/staff/tickets/999999999").expect(404);
  });

  it("claims an unassigned ticket and rejects a conflicting claim", async () => {
    await staffAgent
      .post(`/api/staff/tickets/${ticketId}/claim`)
      .set("Origin", origin)
      .expect(403);

    await staffAgent
      .post(`/api/staff/tickets/${ticketId}/claim`)
      .set("Origin", origin)
      .set("X-CSRF-Token", staffCsrfToken)
      .expect(200)
      .expect((response) => expect(response.body.owner).toMatchObject({ id: staffAId, name: "Detail Staff A" }));

    await otherStaffAgent
      .post(`/api/staff/tickets/${ticketId}/claim`)
      .set("Origin", origin)
      .set("X-CSRF-Token", otherStaffCsrfToken)
      .expect(409);
  });

  it("reassigns only to active IT Staff and can unassign a ticket", async () => {
    await staffAgent
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Origin", origin)
      .set("X-CSRF-Token", staffCsrfToken)
      .send({ ownerId: staffBId })
      .expect(200)
      .expect((response) => expect(response.body.owner).toMatchObject({ id: staffBId, name: "Detail Staff B" }));

    await staffAgent
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Origin", origin)
      .set("X-CSRF-Token", staffCsrfToken)
      .send({ ownerId: inactiveStaffId })
      .expect(400);

    await staffAgent
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Origin", origin)
      .set("X-CSRF-Token", staffCsrfToken)
      .send({ ownerId: requesterUserId })
      .expect(400);

    await staffAgent
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Origin", origin)
      .set("X-CSRF-Token", staffCsrfToken)
      .send({ ownerId: null })
      .expect(200)
      .expect((response) => expect(response.body.owner).toBeNull());
  });

  it("updates IT priority and only permits legal status transitions", async () => {
    await staffAgent
      .patch(`/api/staff/tickets/${ticketId}/workflow`)
      .set("Origin", origin)
      .set("X-CSRF-Token", staffCsrfToken)
      .send({ status: "Cancelled" })
      .expect(400);

    await staffAgent
      .patch(`/api/staff/tickets/${ticketId}/workflow`)
      .set("Origin", origin)
      .set("X-CSRF-Token", staffCsrfToken)
      .send({ itPriority: "Urgent", status: "Open" })
      .expect(200)
      .expect((response) => expect(response.body).toMatchObject({ id: ticketId, itPriority: "Urgent", status: "Open" }));

    await staffAgent
      .patch(`/api/staff/tickets/${ticketId}/workflow`)
      .set("Origin", origin)
      .set("X-CSRF-Token", staffCsrfToken)
      .send({ status: "New" })
      .expect(409);

    await staffAgent
      .patch(`/api/staff/tickets/${ticketId}/workflow`)
      .set("Origin", origin)
      .set("X-CSRF-Token", staffCsrfToken)
      .send({ itPriority: "Critical" })
      .expect(400);

    await staffAgent
      .patch(`/api/staff/tickets/${ticketId}/workflow`)
      .set("Origin", origin)
      .set("X-CSRF-Token", staffCsrfToken)
      .send({ status: "Cancelled", confirm: true })
      .expect(200)
      .expect((response) => expect(response.body.status).toBe("Cancelled"));
  });
});

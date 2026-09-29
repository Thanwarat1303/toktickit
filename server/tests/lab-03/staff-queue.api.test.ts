import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const marker = `STAFF-QUEUE-${Date.now()}`;
const password = "StaffFixture123!";
let staffId: number;
let requesterId: number;
let requesterUserId: number;
let ticketId: number;
let staffAgent: request.Agent;

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  const [staff, requester, category, system] = await Promise.all([
    prisma.user.create({ data: { name: "Queue Staff", email: `${marker.toLowerCase()}-staff@example.test`, role: "IT_STAFF", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Queue Requester", email: `${marker.toLowerCase()}-requester@example.test`, role: "REQUESTER", passwordHash, mustChangePassword: false } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);
  staffId = staff.id;
  requesterUserId = requester.id;
  const requesterProfile = await prisma.requester.create({ data: { userId: requester.id, name: requester.name, email: requester.email } });
  requesterId = requesterProfile.id;
  const ticket = await prisma.ticket.create({ data: { ticketNumber: `${marker}-TICKET`, requesterId, categoryId: category.id, relatedSystemId: system.id, summary: `${marker} printer issue`, description: "Queue fixture description", priority: "HIGH", itPriority: "HIGH", currentStatus: "New" } });
  ticketId = ticket.id;
  staffAgent = request.agent(app);
  await staffAgent.post("/api/auth/login").send({ email: staff.email, password }).expect(200);
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { id: ticketId } });
  await prisma.session.deleteMany({ where: { userId: { in: [staffId, requesterId] } } });
  await prisma.requester.deleteMany({ where: { id: requesterId } });
  await prisma.user.deleteMany({ where: { id: { in: [staffId, requesterUserId] } } });
  await prisma.$disconnect();
});

describe("GET /api/staff/tickets", () => {
  it("requires an IT Staff session", async () => {
    expect((await request(app).get("/api/staff/tickets")).status).toBe(401);
  });

  it("returns a searchable shared queue with owner and requester display data", async () => {
    const response = await staffAgent.get("/api/staff/tickets").query({ search: marker });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ pagination: { totalItems: 1 }, tickets: [expect.objectContaining({ id: ticketId, requesterName: "Queue Requester", owner: null, itPriority: "High" })] });
  });

  it("supports unassigned filtering, sorting, and rejects invalid paging", async () => {
    expect((await staffAgent.get("/api/staff/tickets").query({ search: marker, ownerId: 0, sortBy: "itPriority", sortDir: "asc" })).status).toBe(200);
    expect((await staffAgent.get("/api/staff/tickets").query({ page: 0 })).status).toBe(400);
    expect((await staffAgent.get("/api/staff/tickets").query({ pageSize: 51 })).status).toBe(400);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

const ORIGIN = "http://localhost:5173";
const prefix = `authorization-fixture-${Date.now()}`;
const password = "FixturePass123!";

describe("Lab 3 requester authorization regression", () => {
  const prisma = getPrisma();
  let ownerUserId: number;
  let otherRequesterId: number;
  let ownerTicketId: number;
  let otherTicketId: number;
  let csrfToken = "";
  let ownerAgent: request.Agent;
  let staffAgent: request.Agent;

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    const [ownerUser, otherUser, staffUser, category, relatedSystem] = await Promise.all([
      prisma.user.create({ data: { name: "Authorization Owner", email: `${prefix}-owner@example.test`, role: "REQUESTER", passwordHash, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Authorization Other", email: `${prefix}-other@example.test`, role: "REQUESTER", passwordHash, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Authorization Staff", email: `${prefix}-staff@example.test`, role: "IT_STAFF", passwordHash, mustChangePassword: false } }),
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    ]);
    ownerUserId = ownerUser.id;
    const [ownerRequester, otherRequester] = await Promise.all([
      prisma.requester.create({ data: { userId: ownerUser.id, name: ownerUser.name, email: ownerUser.email } }),
      prisma.requester.create({ data: { userId: otherUser.id, name: otherUser.name, email: otherUser.email } }),
    ]);
    otherRequesterId = otherRequester.id;
    const [ownerTicket, otherTicket] = await Promise.all([
      prisma.ticket.create({ data: { ticketNumber: `AUTH-${Date.now()}-1`, requesterId: ownerRequester.id, categoryId: category.id, relatedSystemId: relatedSystem.id, summary: "Owner fixture", description: "Owner fixture ticket", priority: "LOW" } }),
      prisma.ticket.create({ data: { ticketNumber: `AUTH-${Date.now()}-2`, requesterId: otherRequester.id, categoryId: category.id, relatedSystemId: relatedSystem.id, summary: "Other fixture", description: "Other fixture ticket", priority: "LOW" } }),
    ]);
    ownerTicketId = ownerTicket.id;
    otherTicketId = otherTicket.id;

    ownerAgent = request.agent(app);
    const login = await ownerAgent.post("/api/auth/login").send({ email: ownerUser.email, password }).expect(200);
    csrfToken = login.body.csrfToken;
    staffAgent = request.agent(app);
    await staffAgent.post("/api/auth/login").send({ email: staffUser.email, password }).expect(200);
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { id: { in: [ownerTicketId, otherTicketId] } } });
    await prisma.session.deleteMany({ where: { user: { email: { startsWith: prefix } } } });
    await prisma.requester.deleteMany({ where: { email: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  });

  it("rejects unauthenticated and non-Requester access before exposing ticket data", async () => {
    await request(app).get("/api/tickets").expect(401);
    await staffAgent.get("/api/tickets").expect(403);
  });

  it("derives the ticket list from the session even if X-Requester-Id names another requester", async () => {
    const response = await ownerAgent
      .get("/api/tickets")
      .set("X-Requester-Id", String(otherRequesterId))
      .expect(200);
    expect(response.body.items.map((ticket: { id: number }) => ticket.id)).toContain(ownerTicketId);
    expect(response.body.items.map((ticket: { id: number }) => ticket.id)).not.toContain(otherTicketId);
  });

  it("masks another Requester's ticket as not found", async () => {
    await ownerAgent.get(`/api/tickets/${otherTicketId}`).set("X-Requester-Id", String(otherRequesterId)).expect(404);
  });

  it("requires the session CSRF token for state-changing requester routes", async () => {
    await ownerAgent
      .post("/api/tickets")
      .set("Origin", ORIGIN)
      .send({ categoryId: 1, relatedSystemId: 1, summary: "No CSRF", description: "This request must be rejected.", priority: "Low" })
      .expect(403);
  });

  it("ignores a spoofed requesterId in a create body and owns the ticket through the session", async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    const response = await ownerAgent
      .post("/api/tickets")
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", csrfToken)
      .send({ requesterId: otherRequesterId, categoryId: category.id, relatedSystemId: relatedSystem.id, summary: "Session-owned fixture", description: "The server must ignore client ownership input.", priority: "Low" })
      .expect(201);
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: response.body.id }, include: { requester: true } });
    expect(ticket.requester.userId).toBe(ownerUserId);
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});

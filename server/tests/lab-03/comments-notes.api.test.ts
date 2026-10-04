import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const marker = `COMMENTS-NOTES-${Date.now()}`;
const password = "CommentsNotesPass123!";
const origin = "http://localhost:5173";
let ticketId: number;
let staffId: number;
let adminId: number;
let requesterId: number;
let otherRequesterId: number;
let requesterProfileId: number;
let otherRequesterProfileId: number;
let staffAgent: request.Agent;
let adminAgent: request.Agent;
let requesterAgent: request.Agent;
let otherRequesterAgent: request.Agent;
let staffCsrf: string;
let requesterCsrf: string;

async function loginAgent(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password }).expect(200);
  return { agent, csrf: response.body.csrfToken as string };
}

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  const [staff, admin, requester, otherRequester, category, relatedSystem] = await Promise.all([
    prisma.user.create({ data: { name: "Comments Staff", email: `${marker.toLowerCase()}-staff@example.test`, role: "IT_STAFF", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Comments Admin", email: `${marker.toLowerCase()}-admin@example.test`, role: "ADMINISTRATOR", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Comments Requester", email: `${marker.toLowerCase()}-requester@example.test`, role: "REQUESTER", passwordHash, mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Other Requester", email: `${marker.toLowerCase()}-other@example.test`, role: "REQUESTER", passwordHash, mustChangePassword: false } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);
  staffId = staff.id; adminId = admin.id; requesterId = requester.id; otherRequesterId = otherRequester.id;
  const [profile, otherProfile] = await Promise.all([
    prisma.requester.create({ data: { userId: requester.id, name: requester.name, email: requester.email } }),
    prisma.requester.create({ data: { userId: otherRequester.id, name: otherRequester.name, email: otherRequester.email } }),
  ]);
  requesterProfileId = profile.id; otherRequesterProfileId = otherProfile.id;
  const ticket = await prisma.ticket.create({ data: { ticketNumber: `${marker}-TICKET`, requesterId: profile.id, categoryId: category.id, relatedSystemId: relatedSystem.id, summary: `${marker} ticket`, description: "Comments and notes fixture.", priority: "MEDIUM", itPriority: "MEDIUM", currentStatus: "New" } });
  ticketId = ticket.id;
  const [staffLogin, adminLogin, requesterLogin, otherRequesterLogin] = await Promise.all([loginAgent(staff.email), loginAgent(admin.email), loginAgent(requester.email), loginAgent(otherRequester.email)]);
  staffAgent = staffLogin.agent; staffCsrf = staffLogin.csrf;
  adminAgent = adminLogin.agent;
  requesterAgent = requesterLogin.agent; requesterCsrf = requesterLogin.csrf;
  otherRequesterAgent = otherRequesterLogin.agent;
});

afterAll(async () => {
  await prisma.ticketComment.deleteMany({ where: { ticketId } });
  await prisma.internalNote.deleteMany({ where: { ticketId } });
  await prisma.ticket.deleteMany({ where: { id: ticketId } });
  await prisma.session.deleteMany({ where: { userId: { in: [staffId, adminId, requesterId, otherRequesterId] } } });
  await prisma.requester.deleteMany({ where: { id: { in: [requesterProfileId, otherRequesterProfileId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [staffId, adminId, requesterId, otherRequesterId] } } });
  await prisma.$disconnect();
});

describe("Public Comments and Internal Notes", () => {
  it("API-14: appends a public comment with server-derived author and exposes it to permitted readers", async () => {
    const posted = await requesterAgent.post(`/api/tickets/${ticketId}/comments`).set("Origin", origin).set("X-CSRF-Token", requesterCsrf).send({ content: "Requester-visible update" }).expect(201);
    expect(posted.body).toMatchObject({ ticketId, author: { id: requesterId, name: "Comments Requester" }, content: "Requester-visible update" });
    expect(posted.body.createdAt).toBeDefined();

    const staffPost = await staffAgent.post(`/api/tickets/${ticketId}/comments`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ content: "Staff-visible update" }).expect(201);
    expect(staffPost.body.author.id).toBe(staffId);

    for (const agent of [requesterAgent, staffAgent, adminAgent]) {
      const response = await agent.get(`/api/tickets/${ticketId}/comments`).expect(200);
      expect(response.body.map((comment: { content: string }) => comment.content)).toEqual(expect.arrayContaining(["Requester-visible update", "Staff-visible update"]));
    }
    await otherRequesterAgent.get(`/api/tickets/${ticketId}/comments`).expect(404);
  });

  it("API-15: keeps Internal Notes unavailable to Requesters but readable to staff and administrators", async () => {
    const posted = await staffAgent.post(`/api/tickets/${ticketId}/notes`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ content: "Internal triage detail" }).expect(201);
    expect(posted.body).toMatchObject({ ticketId, author: { id: staffId }, content: "Internal triage detail" });
    await requesterAgent.get(`/api/tickets/${ticketId}/notes`).expect(403);
    await requesterAgent.post(`/api/tickets/${ticketId}/notes`).set("Origin", origin).set("X-CSRF-Token", requesterCsrf).send({ content: "Not permitted" }).expect(403);
    for (const agent of [staffAgent, adminAgent]) {
      const response = await agent.get(`/api/tickets/${ticketId}/notes`).expect(200);
      expect(response.body.map((note: { content: string }) => note.content)).toContain("Internal triage detail");
    }
  });

  it("API-16: rejects empty, whitespace-only, and over-limit comment/note content without writing a row", async () => {
    const beforeComments = await prisma.ticketComment.count({ where: { ticketId } });
    const beforeNotes = await prisma.internalNote.count({ where: { ticketId } });
    await requesterAgent.post(`/api/tickets/${ticketId}/comments`).set("Origin", origin).set("X-CSRF-Token", requesterCsrf).send({ content: "   " }).expect(400);
    await staffAgent.post(`/api/tickets/${ticketId}/comments`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ content: "x".repeat(2001) }).expect(400);
    await staffAgent.post(`/api/tickets/${ticketId}/notes`).set("Origin", origin).set("X-CSRF-Token", staffCsrf).send({ content: "\n\t" }).expect(400);
    expect(await prisma.ticketComment.count({ where: { ticketId } })).toBe(beforeComments);
    expect(await prisma.internalNote.count({ where: { ticketId } })).toBe(beforeNotes);
  });
});

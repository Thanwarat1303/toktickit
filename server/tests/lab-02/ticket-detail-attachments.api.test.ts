import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Priority } from "@prisma/client";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";
import { TEST_ORIGIN, createRequesterSession, removeRequesterSession, type RequesterSessionFixture } from "../helpers/requester-session.js";

const prisma = getPrisma();
const marker = `Feature 17 automated test ${Date.now()}`;
const uploadDir = path.resolve(process.cwd(), "uploads");
const storedFilename = `feature-17-${Date.now()}.txt`;
const fileBytes = Buffer.from("TokTickIT attachment download test");
let owner: RequesterSessionFixture;
let other: RequesterSessionFixture;
let staffAgent: request.Agent;
let staffUserId: number;
let ticketId: number;
let attachmentId: number;

function upload(ticket: number, file: Buffer, filename: string, contentType: string) {
  return owner.agent.post(`/api/tickets/${ticket}/attachments`).set("Origin", TEST_ORIGIN).set("X-CSRF-Token", owner.csrfToken)
    .attach("file", file, { filename, contentType });
}

beforeAll(async () => {
  [owner, other] = await Promise.all([createRequesterSession("attachments-owner"), createRequesterSession("attachments-other")]);
  const staffEmail = `attachments-staff-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const staffPassword = "FixturePass123!";
  const staff = await prisma.user.create({ data: { name: "Attachment staff fixture", email: staffEmail, passwordHash: await hashPassword(staffPassword), role: "IT_STAFF", mustChangePassword: false } });
  staffUserId = staff.id;
  staffAgent = request.agent(app);
  await staffAgent.post("/api/auth/login").send({ email: staffEmail, password: staffPassword }).expect(200);
  const [category, relatedSystem] = await Promise.all([prisma.category.findFirstOrThrow({ where: { isActive: true } }), prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })]);
  const ticket = await prisma.ticket.create({ data: { ticketNumber: `TK-F17-${Date.now()}`, requesterId: owner.requesterId, categoryId: category.id, relatedSystemId: relatedSystem.id, summary: `${marker} ticket detail`, description: "Attachment fixture.", priority: Priority.HIGH, currentStatus: "New" } });
  ticketId = ticket.id;
  mkdirSync(uploadDir, { recursive: true });
  writeFileSync(path.join(uploadDir, storedFilename), fileBytes);
  attachmentId = (await prisma.attachment.create({ data: { ticketId, originalFilename: "network evidence.txt", storedFilename, mimeType: "text/plain", sizeBytes: fileBytes.length } })).id;
});

afterAll(async () => {
  const attachments = await prisma.attachment.findMany({ where: { ticket: { summary: { startsWith: marker } } }, select: { storedFilename: true } });
  await prisma.attachment.deleteMany({ where: { ticket: { summary: { startsWith: marker } } } });
  await prisma.ticket.deleteMany({ where: { summary: { startsWith: marker } } });
  for (const attachment of attachments) { try { unlinkSync(path.join(uploadDir, attachment.storedFilename)); } catch { /* cleanup */ } }
  await prisma.session.deleteMany({ where: { userId: staffUserId } });
  await prisma.user.delete({ where: { id: staffUserId } });
  await Promise.all([removeRequesterSession(owner), removeRequesterSession(other)]);
  await prisma.$disconnect();
});

describe("ticket detail and attachments", () => {
  it("returns details to the owner and masks another requester's ticket", async () => {
    expect((await owner.agent.get(`/api/tickets/${ticketId}`)).status).toBe(200);
    expect((await other.agent.get(`/api/tickets/${ticketId}`)).status).toBe(404);
  });

  it("uploads only permitted files and enforces the active-attachment limit", async () => {
    expect((await upload(ticketId, Buffer.from("%PDF-1.4 valid"), "valid.pdf", "application/pdf")).status).toBe(201);
    expect((await upload(ticketId, Buffer.from("not allowed"), "script.exe", "application/x-msdownload")).status).toBe(415);
    await prisma.attachment.createMany({ data: Array.from({ length: 4 }, (_, index) => ({ ticketId, originalFilename: `existing-${index}.pdf`, storedFilename: `feature-17-limit-${ticketId}-${index}.pdf`, mimeType: "application/pdf", sizeBytes: 10 })) });
    expect((await upload(ticketId, Buffer.from("%PDF-1.4 sixth"), "sixth.pdf", "application/pdf")).status).toBe(409);
  });

  it("requires CSRF and ownership for state-changing attachment actions", async () => {
    const noCsrf = await owner.agent.post(`/api/tickets/${ticketId}/attachments`).set("Origin", TEST_ORIGIN).attach("file", Buffer.from("%PDF"), { filename: "no-csrf.pdf", contentType: "application/pdf" });
    const otherUpload = await other.agent.post(`/api/tickets/${ticketId}/attachments`).set("Origin", TEST_ORIGIN).set("X-CSRF-Token", other.csrfToken).attach("file", Buffer.from("%PDF"), { filename: "other.pdf", contentType: "application/pdf" });
    expect(noCsrf.status).toBe(403);
    expect(otherUpload.status).toBe(404);
  });

  it("allows IT Staff to download an active attachment from the shared queue", async () => {
    const download = await staffAgent.get(`/api/attachments/${attachmentId}/download`);
    expect(download.status).toBe(200);
    expect(download.text).toBe(fileBytes.toString());
  });

  it("lists, downloads, and soft-removes an attachment for its owner", async () => {
    expect((await owner.agent.get(`/api/tickets/${ticketId}/attachments`)).status).toBe(200);
    const download = await owner.agent.get(`/api/attachments/${attachmentId}/download`);
    expect(download.status).toBe(200);
    expect(download.text).toBe(fileBytes.toString());
    const removed = await owner.agent.delete(`/api/attachments/${attachmentId}`).set("Origin", TEST_ORIGIN).set("X-CSRF-Token", owner.csrfToken).send({ removalReason: "Uploaded newer evidence" });
    expect(removed.status).toBe(200);
    expect((await owner.agent.get(`/api/attachments/${attachmentId}/download`)).status).toBe(410);
  });

  it("requires authentication for requester attachment routes", async () => {
    expect((await request(app).get(`/api/tickets/${ticketId}/attachments`)).status).toBe(401);
  });
});

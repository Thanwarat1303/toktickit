import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Priority } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const marker = `Feature 17 automated test ${Date.now()}`;
const uploadDir = path.resolve(process.cwd(), "uploads");
const storedFilename = `feature-17-${Date.now()}.txt`;
const fileBytes = Buffer.from("TokTickIT attachment download test");

let ownerId: number;
let otherRequesterId: number;
let categoryId: number;
let relatedSystemId: number;
let ticketId: number;
let attachmentId: number;
let removedAttachmentId: number;
let createdTicketIds: number[] = [];

beforeAll(async () => {
  const [owner, other, category, relatedSystem] = await Promise.all([
    prisma.requester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.requester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "desc" } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
  ]);

  ownerId = owner.id;
  otherRequesterId = other.id === owner.id ? owner.id + 1000 : other.id;
  categoryId = category.id;
  relatedSystemId = relatedSystem.id;

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TK-F17-${Date.now()}`,
      requesterId: ownerId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: `${marker} ticket detail`,
      description: "Created only for ticket detail attachment tests.",
      priority: Priority.HIGH,
      currentStatus: "New",
    },
  });
  ticketId = ticket.id;
  createdTicketIds = [ticketId];

  mkdirSync(uploadDir, { recursive: true });
  writeFileSync(path.join(uploadDir, storedFilename), fileBytes);

  const activeAttachment = await prisma.attachment.create({
    data: {
      ticketId,
      originalFilename: "network evidence.txt",
      storedFilename,
      mimeType: "text/plain",
      sizeBytes: fileBytes.length,
    },
  });
  attachmentId = activeAttachment.id;

  const removedAttachment = await prisma.attachment.create({
    data: {
      ticketId,
      originalFilename: "old evidence.pdf",
      storedFilename: `removed-${storedFilename}`,
      mimeType: "application/pdf",
      sizeBytes: 100,
      removedAt: new Date(),
      removalReason: "Wrong file",
    },
  });
  removedAttachmentId = removedAttachment.id;
});

afterAll(async () => {
  const attachments = await prisma.attachment.findMany({
    where: { ticketId: { in: createdTicketIds } },
    select: { storedFilename: true },
  });

  await prisma.attachment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });

  for (const attachment of attachments) {
    try {
      unlinkSync(path.join(uploadDir, attachment.storedFilename));
    } catch {
      // Test cleanup should not fail if the file was already removed manually.
    }
  }

  await prisma.$disconnect();
});

describe("Ticket detail and attachments", () => {
  async function createOwnedTicket(summary: string) {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TK-F17-${Date.now()}-${createdTicketIds.length}`,
        requesterId: ownerId,
        categoryId,
        relatedSystemId,
        summary,
        description: "Created only for ticket attachment upload tests.",
        priority: Priority.MEDIUM,
        currentStatus: "New",
      },
    });

    createdTicketIds.push(ticket.id);
    return ticket.id;
  }

  it("returns one ticket detail only for the owner", async () => {
    const ownerResponse = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("X-Requester-Id", String(ownerId));
    const otherResponse = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("X-Requester-Id", String(otherRequesterId));

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body).toMatchObject({
      id: ticketId,
      summary: `${marker} ticket detail`,
      priority: "High",
      status: "New",
    });
    expect(otherResponse.status).toBe(403);
  });

  it("uploads a permitted attachment for the ticket owner", async () => {
    const validFileBytes = Buffer.from("%PDF-1.4 TokTickIT evidence");

    const response = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", String(ownerId))
      .attach("file", validFileBytes, {
        filename: "valid-evidence.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      ticketId,
      originalFilename: "valid-evidence.pdf",
      mimeType: "application/pdf",
      sizeBytes: validFileBytes.length,
      removedAt: null,
      removalReason: null,
    });
    expect(response.body).not.toHaveProperty("storedFilename");
  });

  it("rejects unsupported attachment types", async () => {
    const ticketForUpload = await createOwnedTicket(`${marker} unsupported type`);
    const beforeCount = await prisma.attachment.count({ where: { ticketId: ticketForUpload } });

    const response = await request(app)
      .post(`/api/tickets/${ticketForUpload}/attachments`)
      .set("X-Requester-Id", String(ownerId))
      .attach("file", Buffer.from("not allowed"), {
        filename: "script.exe",
        contentType: "application/x-msdownload",
      });

    const afterCount = await prisma.attachment.count({ where: { ticketId: ticketForUpload } });

    expect(response.status).toBe(415);
    expect(afterCount).toBe(beforeCount);
  });

  it("rejects attachments larger than 5 MB", async () => {
    const ticketForUpload = await createOwnedTicket(`${marker} oversized upload`);

    const response = await request(app)
      .post(`/api/tickets/${ticketForUpload}/attachments`)
      .set("X-Requester-Id", String(ownerId))
      .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1, "a"), {
        filename: "too-large.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(413);
  });

  it("rejects a sixth active attachment", async () => {
    const ticketForUpload = await createOwnedTicket(`${marker} attachment count limit`);

    await prisma.attachment.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        ticketId: ticketForUpload,
        originalFilename: `existing-${index}.pdf`,
        storedFilename: `feature-17-limit-${ticketForUpload}-${index}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 10,
      })),
    });

    const response = await request(app)
      .post(`/api/tickets/${ticketForUpload}/attachments`)
      .set("X-Requester-Id", String(ownerId))
      .attach("file", Buffer.from("%PDF-1.4 sixth"), {
        filename: "sixth.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(409);
  });

  it("rejects attachment upload from another requester", async () => {
    const response = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", String(otherRequesterId))
      .attach("file", Buffer.from("%PDF-1.4 wrong owner"), {
        filename: "wrong-owner.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(403);
  });

  it("lists public attachment metadata without exposing stored filenames", async () => {
    const response = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", String(ownerId));

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: attachmentId,
        ticketId,
        originalFilename: "network evidence.txt",
        mimeType: "text/plain",
      }),
      expect.objectContaining({
        id: removedAttachmentId,
        removedAt: expect.any(String),
        removalReason: "Wrong file",
      }),
    ]));
    expect(response.body[0]).not.toHaveProperty("storedFilename");
  });

  it("downloads an active attachment only for the owner", async () => {
    const ownerResponse = await request(app)
      .get(`/api/attachments/${attachmentId}/download?requesterId=${ownerId}`);
    const otherResponse = await request(app)
      .get(`/api/attachments/${attachmentId}/download?requesterId=${otherRequesterId}`);

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.headers["content-type"]).toContain("text/plain");
    expect(ownerResponse.text).toBe(fileBytes.toString());
    expect(otherResponse.status).toBe(403);
  });

  it("soft-removes an attachment and blocks future downloads", async () => {
    const removeResponse = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set("X-Requester-Id", String(ownerId))
      .send({ removalReason: "Uploaded newer evidence" });
    const downloadResponse = await request(app)
      .get(`/api/attachments/${attachmentId}/download?requesterId=${ownerId}`);

    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body).toMatchObject({
      id: attachmentId,
      removedAt: expect.any(String),
      removalReason: "Uploaded newer evidence",
    });
    expect(downloadResponse.status).toBe(410);
  });

  it("rejects invalid attachment requests safely", async () => {
    const invalidTicket = await request(app)
      .get("/api/tickets/not-a-number")
      .set("X-Requester-Id", String(ownerId));
    const missingRequester = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`);
    const missingReason = await request(app)
      .delete(`/api/attachments/${removedAttachmentId}`)
      .set("X-Requester-Id", String(ownerId))
      .send({ removalReason: "" });

    expect(invalidTicket.status).toBe(400);
    expect(missingRequester.status).toBe(400);
    expect(missingReason.status).toBe(400);
  });
});

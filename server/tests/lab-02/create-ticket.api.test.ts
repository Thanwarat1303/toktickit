import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const marker = `Feature 14 automated test ${Date.now()}`;

let activeRequesterId: number;
let inactiveRequesterId: number;
let activeCategoryId: number;
let inactiveCategoryId: number;
let activeRelatedSystemId: number;
let inactiveRelatedSystemId: number;

function validTicketBody(overrides: Record<string, unknown> = {}) {
  return {
    categoryId: activeCategoryId,
    relatedSystemId: activeRelatedSystemId,
    summary: `${marker} - Wi-Fi connection issue`,
    description: "The test device cannot connect to the campus Wi-Fi network.",
    priority: "Medium",
    ...overrides,
  };
}

beforeAll(async () => {
  const [activeRequester, inactiveRequester, activeCategory, inactiveCategory, activeSystem, inactiveSystem] =
    await Promise.all([
      prisma.requester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.requester.findFirstOrThrow({ where: { isActive: false }, orderBy: { id: "asc" } }),
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.category.findFirstOrThrow({ where: { isActive: false }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: false }, orderBy: { id: "asc" } }),
    ]);

  activeRequesterId = activeRequester.id;
  inactiveRequesterId = inactiveRequester.id;
  activeCategoryId = activeCategory.id;
  inactiveCategoryId = inactiveCategory.id;
  activeRelatedSystemId = activeSystem.id;
  inactiveRelatedSystemId = inactiveSystem.id;
});

afterAll(async () => {
  await prisma.ticket.deleteMany({
    where: {
      summary: {
        startsWith: marker,
      },
    },
  });
  await prisma.$disconnect();
});

describe("POST /api/tickets", () => {
  it("creates a valid ticket with a backend-generated number and New status", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(activeRequesterId))
      .send(validTicketBody({
        summary: `  ${marker} - trim this summary  `,
        description: "  The saved description is trimmed by the API.  ",
      }));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      ticketNumber: expect.stringMatching(/^TK-\d{6}$/),
      status: "New",
      requesterId: activeRequesterId,
      categoryId: activeCategoryId,
      relatedSystemId: activeRelatedSystemId,
      summary: `${marker} - trim this summary`,
      description: "The saved description is trimmed by the API.",
      priority: "Medium",
    });
  });

  it("rejects missing and invalid ticket fields", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(activeRequesterId))
      .send(validTicketBody({ summary: "   " }));

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/summary is required/i);
  });

  it("rejects an invalid priority and an invalid requester header", async () => {
    const invalidPriority = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(activeRequesterId))
      .send(validTicketBody({ priority: "Urgent" }));

    const invalidRequester = await request(app)
      .post("/api/tickets")
      .send(validTicketBody());

    expect(invalidPriority.status).toBe(400);
    expect(invalidPriority.body.message).toMatch(/priority/i);
    expect(invalidRequester.status).toBe(400);
    expect(invalidRequester.body.message).toMatch(/requester/i);
  });

  it("rejects missing reference data with a safe not-found response", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(activeRequesterId))
      .send(validTicketBody({ categoryId: 999999 }));

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/not found/i);
  });

  it("rejects inactive requester, category, and related-system references", async () => {
    const inactiveRequester = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(inactiveRequesterId))
      .send(validTicketBody({ summary: `${marker} - inactive requester` }));

    const inactiveCategory = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(activeRequesterId))
      .send(validTicketBody({
        categoryId: inactiveCategoryId,
        summary: `${marker} - inactive category`,
      }));

    const inactiveSystem = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(activeRequesterId))
      .send(validTicketBody({
        relatedSystemId: inactiveRelatedSystemId,
        summary: `${marker} - inactive system`,
      }));

    expect(inactiveRequester.status).toBe(400);
    expect(inactiveCategory.status).toBe(400);
    expect(inactiveSystem.status).toBe(400);
  });

  it("prevents a duplicate ticket from the same requester within the duplicate window", async () => {
    const body = validTicketBody({ summary: `${marker} - duplicate submission` });

    const firstResponse = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(activeRequesterId))
      .send(body);

    const duplicateResponse = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(activeRequesterId))
      .send(body);

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.message).toMatch(/submitted recently/i);
  });
});

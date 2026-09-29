import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { TEST_ORIGIN, createRequesterSession, removeRequesterSession, type RequesterSessionFixture } from "../helpers/requester-session.js";

const prisma = getPrisma();
const marker = `Feature 14 automated test ${Date.now()}`;
let fixture: RequesterSessionFixture;
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

function postTicket(body: Record<string, unknown>) {
  return fixture.agent.post("/api/tickets").set("Origin", TEST_ORIGIN).set("X-CSRF-Token", fixture.csrfToken).send(body);
}

beforeAll(async () => {
  fixture = await createRequesterSession("create-ticket");
  const [activeCategory, inactiveCategory, activeSystem, inactiveSystem] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.category.findFirstOrThrow({ where: { isActive: false } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: false } }),
  ]);
  activeCategoryId = activeCategory.id;
  inactiveCategoryId = inactiveCategory.id;
  activeRelatedSystemId = activeSystem.id;
  inactiveRelatedSystemId = inactiveSystem.id;
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { summary: { startsWith: marker } } });
  await removeRequesterSession(fixture);
  await prisma.$disconnect();
});

describe("POST /api/tickets", () => {
  it("creates a valid ticket owned by the signed-in requester", async () => {
    const response = await postTicket(validTicketBody({ summary: `  ${marker} - trim this summary  `, description: "  Saved description.  " }));
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      ticketNumber: expect.stringMatching(/^TK-\d{6}$/), status: "New", requesterId: fixture.requesterId,
      categoryId: activeCategoryId, relatedSystemId: activeRelatedSystemId,
      summary: `${marker} - trim this summary`, description: "Saved description.", priority: "Medium",
    });
  });

  it("rejects invalid ticket fields and unsupported reference data", async () => {
    const missingSummary = await postTicket(validTicketBody({ summary: "   " }));
    const invalidPriority = await postTicket(validTicketBody({ priority: "Urgent" }));
    const missingCategory = await postTicket(validTicketBody({ categoryId: 999999 }));
    expect(missingSummary.status).toBe(400);
    expect(invalidPriority.status).toBe(400);
    expect(missingCategory.status).toBe(404);
  });

  it("enforces the documented field limits", async () => {
    const atLimit = `${marker}${"s".repeat(100 - marker.length)}`;
    const overLimit = `${marker}${"s".repeat(101 - marker.length)}`;
    expect((await postTicket(validTicketBody({ summary: atLimit }))).status).toBe(201);
    expect((await postTicket(validTicketBody({ summary: overLimit }))).status).toBe(400);
    expect((await postTicket(validTicketBody({ description: "d".repeat(2001) }))).status).toBe(400);
  });

  it("rejects inactive category and related-system references", async () => {
    expect((await postTicket(validTicketBody({ categoryId: inactiveCategoryId, summary: `${marker} inactive category` }))).status).toBe(400);
    expect((await postTicket(validTicketBody({ relatedSystemId: inactiveRelatedSystemId, summary: `${marker} inactive system` }))).status).toBe(400);
  });

  it("prevents a duplicate ticket from the same session-owned requester", async () => {
    const body = validTicketBody({ summary: `${marker} duplicate submission` });
    expect((await postTicket(body)).status).toBe(201);
    expect((await postTicket(body)).status).toBe(409);
  });
});

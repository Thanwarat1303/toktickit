import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Priority } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const marker = `Feature 16 automated test ${Date.now()}`;
let ownerId: number;
let otherRequesterId: number;
let categoryId: number;
let relatedSystemId: number;

beforeAll(async () => {
  const [owner, other, category, relatedSystem] = await Promise.all([
    prisma.requester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.requester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "desc" } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
  ]);

  ownerId = owner.id;
  otherRequesterId = other.id === owner.id ? 0 : other.id;
  categoryId = category.id;
  relatedSystemId = relatedSystem.id;

  await prisma.ticket.createMany({
    data: [
      {
        ticketNumber: `TK-F16-A-${Date.now()}`,
        requesterId: ownerId,
        categoryId,
        relatedSystemId,
        summary: `${marker} older network ticket`,
        description: "Created only for the My Tickets API test.",
        priority: Priority.LOW,
        currentStatus: "New",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        ticketNumber: `TK-F16-B-${Date.now()}`,
        requesterId: ownerId,
        categoryId,
        relatedSystemId,
        summary: `${marker} newer Wi-Fi ticket`,
        description: "Created only for the My Tickets API test.",
        priority: Priority.HIGH,
        currentStatus: "New",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ],
  });
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { summary: { startsWith: marker } } });
  await prisma.$disconnect();
});

describe("GET /api/tickets", () => {
  it("returns only the selected requester's tickets, newest first", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", String(ownerId));

    expect(response.status).toBe(200);
    const ours = response.body.items.filter((ticket: { summary: string }) => ticket.summary.startsWith(marker));
    expect(ours).toHaveLength(2);
    expect(ours.map((ticket: { summary: string }) => ticket.summary)).toEqual([
      `${marker} newer Wi-Fi ticket`,
      `${marker} older network ticket`,
    ]);
    expect(response.body).toMatchObject({ page: 1, pageSize: 10, totalPages: expect.any(Number) });
  });

  it("searches and filters only inside the selected requester's tickets", async () => {
    const response = await request(app)
      .get(`/api/tickets?search=Wi-Fi&priority=High&categoryId=${categoryId}`)
      .set("X-Requester-Id", String(ownerId));

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ summary: `${marker} newer Wi-Fi ticket`, priority: "High" }),
    ]));

    if (otherRequesterId) {
      const otherResponse = await request(app)
        .get("/api/tickets")
        .set("X-Requester-Id", String(otherRequesterId));
      expect(otherResponse.body.items.some((ticket: { summary: string }) => ticket.summary.startsWith(marker))).toBe(false);
    }
  });

  it("rejects a missing requester identity and invalid paging", async () => {
    const missingRequester = await request(app).get("/api/tickets");
    const invalidPage = await request(app)
      .get("/api/tickets?page=0")
      .set("X-Requester-Id", String(ownerId));

    expect(missingRequester.status).toBe(400);
    expect(invalidPage.status).toBe(400);
  });
});

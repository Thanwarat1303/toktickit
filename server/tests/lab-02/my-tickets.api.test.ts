import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Priority } from "@prisma/client";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { createRequesterSession, removeRequesterSession, type RequesterSessionFixture } from "../helpers/requester-session.js";

const prisma = getPrisma();
const marker = `Feature 16 automated test ${Date.now()}`;
let fixture: RequesterSessionFixture;
let categoryId: number;
let relatedSystemId: number;

beforeAll(async () => {
  fixture = await createRequesterSession("my-tickets");
  const [category, relatedSystem] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);
  categoryId = category.id;
  relatedSystemId = relatedSystem.id;
  await prisma.ticket.createMany({ data: [
    { ticketNumber: `TK-F16-A-${Date.now()}`, requesterId: fixture.requesterId, categoryId, relatedSystemId, summary: `${marker} older network ticket`, description: "Fixture", priority: Priority.LOW, currentStatus: "New", createdAt: new Date("2026-01-01T00:00:00.000Z") },
    { ticketNumber: `TK-F16-B-${Date.now()}`, requesterId: fixture.requesterId, categoryId, relatedSystemId, summary: `${marker} newer Wi-Fi ticket`, description: "Fixture", priority: Priority.HIGH, currentStatus: "New", createdAt: new Date("2026-01-02T00:00:00.000Z") },
  ] });
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { summary: { startsWith: marker } } });
  await removeRequesterSession(fixture);
  await prisma.$disconnect();
});

describe("GET /api/tickets", () => {
  it("returns the signed-in requester's tickets, newest first", async () => {
    const response = await fixture.agent.get("/api/tickets");
    expect(response.status).toBe(200);
    const ours = response.body.items.filter((ticket: { summary: string }) => ticket.summary.startsWith(marker));
    expect(ours.map((ticket: { summary: string }) => ticket.summary)).toEqual([`${marker} newer Wi-Fi ticket`, `${marker} older network ticket`]);
  });

  it("supports search and filters inside the session-owned ticket list", async () => {
    const response = await fixture.agent.get(`/api/tickets?search=Wi-Fi&priority=High&categoryId=${categoryId}`);
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ summary: `${marker} newer Wi-Fi ticket`, priority: "High" })]));
  });

  it("requires authentication and validates paging", async () => {
    const unauthenticated = await request(app).get("/api/tickets");
    expect(unauthenticated.status).toBe(401);
    expect((await fixture.agent.get("/api/tickets?page=0")).status).toBe(400);
  });
});

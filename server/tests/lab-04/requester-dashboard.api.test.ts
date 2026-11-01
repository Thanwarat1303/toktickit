import { afterAll, beforeAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { dashboardClock, recentWindowStart } from "../../src/dashboard.js";
import { getPrisma } from "../../src/prisma.js";
import { createRequesterSession, removeRequesterSession, type RequesterSessionFixture } from "../helpers/requester-session.js";

const prisma = getPrisma();
const marker = `Requester dashboard ${Date.now()}`;
const dashboardNow = new Date("2026-11-01T10:00:00.000Z");
const recentStart = recentWindowStart(dashboardNow);
let categoryId: number;
let relatedSystemId: number;
let requester: RequesterSessionFixture;
let otherRequester: RequesterSessionFixture;

async function createTicket(
  ownerId: number,
  suffix: string,
  currentStatus: string,
  updatedAt: Date,
) {
  return prisma.ticket.create({
    data: {
      ticketNumber: `${marker}-${suffix}`,
      requesterId: ownerId,
      categoryId,
      relatedSystemId,
      summary: `${marker} ${suffix}`,
      description: "Requester dashboard fixture",
      priority: "MEDIUM",
      currentStatus,
      createdAt: updatedAt,
      updatedAt,
    },
  });
}

describe("Lab 4 Requester dashboard API", () => {
  beforeAll(async () => {
    dashboardClock.now = () => dashboardNow;
    requester = await createRequesterSession("requester-dashboard");
    otherRequester = await createRequesterSession("requester-dashboard-other");
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    ]);
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
  });

  afterEach(async () => {
    await prisma.ticket.deleteMany({ where: { ticketNumber: { startsWith: marker } } });
  });

  afterAll(async () => {
    dashboardClock.now = () => new Date();
    if (requester) await removeRequesterSession(requester);
    if (otherRequester) await removeRequesterSession(otherRequester);
    await prisma.$disconnect();
  });

  it("returns the four requester metrics scoped to the signed-in requester", async () => {
    await createTicket(requester.requesterId, "open", "Open", new Date("2026-10-30T10:00:00.000Z"));
    await createTicket(requester.requesterId, "waiting", "Waiting for Requester", new Date("2026-10-30T11:00:00.000Z"));
    await createTicket(requester.requesterId, "resolved", "Resolved", new Date("2026-10-30T12:00:00.000Z"));
    await createTicket(requester.requesterId, "closed", "Closed", new Date("2026-10-30T13:00:00.000Z"));
    await createTicket(otherRequester.requesterId, "other-open", "Open", new Date("2026-10-30T14:00:00.000Z"));

    const response = await requester.agent.get("/api/dashboard/requester").expect(200);

    expect(response.body).toMatchObject({
      generatedAt: dashboardNow.toISOString(),
      timezone: "Asia/Bangkok",
      openTickets: 2,
      waitingForRequester: 1,
      recentlyUpdated: expect.any(Array),
      recentlyResolved: expect.any(Array),
    });
    expect(response.body.recentlyUpdated.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).not.toContain(`${marker}-other-open`);
    expect(response.body.recentlyResolved.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toEqual([`${marker}-resolved`]);
  });

  it("includes all five open statuses in the open total and does not count terminal statuses", async () => {
    for (const [index, status] of ["New", "Open", "In Progress", "Waiting for Requester", "Reopened", "Resolved", "Closed", "Cancelled"].entries()) {
      await createTicket(requester.requesterId, `status-${index}`, status, new Date(recentStart.getTime() + index * 1000));
    }

    const response = await requester.agent.get("/api/dashboard/requester").expect(200);

    expect(response.body.openTickets).toBe(5);
    expect(response.body.waitingForRequester).toBe(1);
  });

  it("uses the Bangkok seven-day boundary and excludes older updates", async () => {
    await createTicket(requester.requesterId, "at-boundary", "Open", recentStart);
    await createTicket(requester.requesterId, "before-boundary", "Open", new Date(recentStart.getTime() - 1));

    const response = await requester.agent.get("/api/dashboard/requester").expect(200);

    const numbers = response.body.recentlyUpdated.map((ticket: { ticketNumber: string }) => ticket.ticketNumber);
    expect(numbers).toContain(`${marker}-at-boundary`);
    expect(numbers).not.toContain(`${marker}-before-boundary`);
  });

  it("returns recent lists in updated-descending order and limits each list to five rows", async () => {
    for (let index = 0; index < 6; index += 1) {
      await createTicket(requester.requesterId, `recent-${index}`, "Open", new Date(recentStart.getTime() + index * 60_000));
    }

    const response = await requester.agent.get("/api/dashboard/requester").expect(200);

    expect(response.body.recentlyUpdated).toHaveLength(5);
    expect(response.body.recentlyUpdated.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toEqual([
      `${marker}-recent-5`, `${marker}-recent-4`, `${marker}-recent-3`, `${marker}-recent-2`, `${marker}-recent-1`,
    ]);
  });

  it("returns 403 when the requester profile has been deactivated", async () => {
    await prisma.requester.update({ where: { id: requester.requesterId }, data: { isActive: false } });
    try {
      await requester.agent.get("/api/dashboard/requester").expect(403);
    } finally {
      await prisma.requester.update({ where: { id: requester.requesterId }, data: { isActive: true } });
    }
  });
});

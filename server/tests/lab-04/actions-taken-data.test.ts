import { afterAll, describe, expect, it } from "vitest";
import { ActionStatus } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { seedLab2Data } from "../../prisma/seed-data.js";

const seedTickets = { ticketNumber: { startsWith: "TKT-SEED-" } };
const openStatuses: ActionStatus[] = [ActionStatus.PLANNED, ActionStatus.IN_PROGRESS];

describe("Lab 4 Actions Taken schema and seed", () => {
  const prisma = getPrisma();

  it("adds version 1 to existing and newly seeded tickets", async () => {
    const tickets = await prisma.ticket.findMany({ where: seedTickets, select: { version: true } });
    expect(tickets).toHaveLength(12);
    expect(tickets.every((ticket) => ticket.version === 1)).toBe(true);
  });

  it("is idempotent: reseeding preserves ticket, action and revision counts", async () => {
    const count = async () => ({
      tickets: await prisma.ticket.count({ where: seedTickets }),
      actions: await prisma.actionTaken.count({ where: { ticket: seedTickets } }),
      revisions: await prisma.actionTakenRevision.count({ where: { actionTaken: { ticket: seedTickets } } }),
    });
    const before = await count();
    await seedLab2Data(prisma);
    await seedLab2Data(prisma);
    expect(await count()).toEqual(before);
  });

  it("seeds every ticket status and every priority", async () => {
    const tickets = await prisma.ticket.findMany({ where: seedTickets, select: { currentStatus: true, priority: true, itPriority: true } });
    expect(new Set(tickets.map((ticket) => ticket.currentStatus))).toEqual(new Set([
      "New", "Open", "In Progress", "Waiting for Requester", "Resolved", "Closed", "Reopened", "Cancelled",
    ]));
    expect(new Set(tickets.map((ticket) => ticket.priority))).toEqual(new Set(["LOW", "MEDIUM", "HIGH"]));
    expect(new Set(tickets.map((ticket) => ticket.itPriority))).toEqual(new Set(["LOW", "MEDIUM", "HIGH"]));
  });

  it("seeds zero, one and several actions, including all four action statuses", async () => {
    const tickets = await prisma.ticket.findMany({ where: seedTickets, include: { actionsTaken: true } });
    const actionCounts = tickets.map((ticket) => ticket.actionsTaken.length);
    const statuses = tickets.flatMap((ticket) => ticket.actionsTaken.map((action) => action.status));
    expect(actionCounts).toContain(0);
    expect(actionCounts).toContain(1);
    expect(Math.max(...actionCounts)).toBeGreaterThanOrEqual(3);
    expect(new Set(statuses)).toEqual(new Set(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]));
  });

  it("keeps RESOLVED and CLOSED seeded tickets free of open actions", async () => {
    const tickets = await prisma.ticket.findMany({
      where: { ...seedTickets, currentStatus: { in: ["Resolved", "Closed"] } },
      include: { actionsTaken: true },
    });
    expect(tickets).toHaveLength(2);
    for (const ticket of tickets) {
      expect(ticket.assignedStaffId).not.toBeNull();
      expect(ticket.actionsTaken.some((action) => openStatuses.includes(action.status))).toBe(false);
      expect(ticket.actionsTaken.some((action) => action.status === "COMPLETED")).toBe(true);
    }
  });

  it("writes immutable revision 1 with every seeded action", async () => {
    const actions = await prisma.actionTaken.findMany({ where: { ticket: seedTickets }, include: { revisions: true } });
    expect(actions.length).toBeGreaterThanOrEqual(10);
    for (const action of actions) {
      expect(action.version).toBe(1);
      expect(action.revisions).toHaveLength(1);
      expect(action.revisions[0]).toMatchObject({
        revision: 1,
        editedById: action.performedById,
        status: action.status,
        assigneeId: action.assigneeId,
        description: action.description,
        result: action.result,
        followUpRequired: action.followUpRequired,
        followUpNote: action.followUpNote,
        attachmentNotes: action.attachmentNotes,
      });
    }
  });

  it("provides both zero and non-zero open-action dashboard fixtures", async () => {
    const staff = await prisma.user.findMany({
      where: { email: { in: ["kanya.staff@toktickit.local", "narin.staff@toktickit.local", "pimchanok.staff@toktickit.local", "admin@toktickit.local"] } },
      select: { id: true },
    });
    const counts = await Promise.all(staff.map((user) => prisma.actionTaken.count({
      where: { assigneeId: user.id, status: { in: [...openStatuses] }, ticket: { currentStatus: { in: ["New", "Open", "In Progress", "Waiting for Requester", "Reopened"] } } },
    })));
    expect(counts.some((count) => count > 0)).toBe(true);
    expect(counts.some((count) => count === 0)).toBe(true);
  });

  it("uses the same action time twice on one ticket, so ordering also needs id", async () => {
    const duplicateTimes = await prisma.$queryRaw<Array<{ actionAt: Date; count: bigint }>>`
      SELECT "actionAt", COUNT(*)::bigint AS "count"
      FROM "ActionTaken"
      WHERE "ticketId" = (SELECT "id" FROM "Ticket" WHERE "ticketNumber" = 'TKT-SEED-003')
      GROUP BY "actionAt"
      HAVING COUNT(*) > 1
    `;
    expect(duplicateTimes).toHaveLength(1);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});

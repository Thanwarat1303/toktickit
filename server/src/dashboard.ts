import type { Express, Response } from "express";
import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { requireAuth, requirePasswordUpToDate, requireRole, type AuthenticatedRequest } from "./auth.js";

export const DASHBOARD_TIMEZONE = "Asia/Bangkok";
export const OPEN_TICKET_STATUSES = ["New", "Open", "In Progress", "Waiting for Requester", "Reopened"] as const;
const ALL_TICKET_STATUSES = ["New", "Open", "In Progress", "Waiting for Requester", "Resolved", "Closed", "Reopened", "Cancelled"] as const;
const IT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const LIMIT = 5;
const ACTION_DESCRIPTION_LIMIT = 120;

export const dashboardClock: { now: () => Date } = { now: () => new Date() };

export function recentWindowStart(now: Date = dashboardClock.now(), timeZone = DASHBOARD_TIMEZONE): Date {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const wholeSecond = Math.floor(now.getTime() / 1000) * 1000;
  const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offsetMs = localAsUtc - wholeSecond;
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - 6) - offsetMs);
}

export function recentUpdatedFilter(now: Date = dashboardClock.now()): { updatedAt: { gte: Date } } {
  return { updatedAt: { gte: recentWindowStart(now) } };
}

export function briefDescription(value: string): string {
  const chars = Array.from(value);
  return chars.length > ACTION_DESCRIPTION_LIMIT ? `${chars.slice(0, ACTION_DESCRIPTION_LIMIT).join("")}…` : value;
}

export function countsByKey<K extends string>(keys: readonly K[], rows: Array<{ key: string; n: number }>): Record<K, number> {
  const result = {} as Record<K, number>;
  for (const key of keys) result[key] = rows.find((row) => row.key === key)?.n ?? 0;
  return result;
}

const ticketBrief = { id: true, ticketNumber: true, summary: true, currentStatus: true, itPriority: true, updatedAt: true } as const;
const recentOrder: Prisma.TicketOrderByWithRelationInput[] = [{ updatedAt: "desc" }, { id: "desc" }];

async function requesterIdFor(req: AuthenticatedRequest): Promise<number | undefined> {
  const profile = await getPrisma().requester.findUnique({ where: { userId: req.auth!.user.id }, select: { id: true, isActive: true } });
  return profile?.isActive ? profile.id : undefined;
}

export function registerDashboardRoutes(app: Express): void {
  app.get("/api/dashboard/requester", requireAuth, requireRole("REQUESTER"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const requesterId = await requesterIdFor(req);
      if (!requesterId) return res.status(403).json({ error: "Requester profile is not available." });
      const prisma = getPrisma();
      const now = dashboardClock.now();
      const own = { requesterId };
      const recent = recentUpdatedFilter(now);
      const [openTickets, waitingForRequester, recentlyUpdated, recentlyResolved] = await Promise.all([
        prisma.ticket.count({ where: { ...own, currentStatus: { in: [...OPEN_TICKET_STATUSES] } } }),
        prisma.ticket.count({ where: { ...own, currentStatus: "Waiting for Requester" } }),
        prisma.ticket.findMany({ where: { ...own, ...recent }, orderBy: recentOrder, take: LIMIT, select: ticketBrief }),
        prisma.ticket.findMany({ where: { ...own, currentStatus: "Resolved", ...recent }, orderBy: recentOrder, take: LIMIT, select: ticketBrief }),
      ]);
      return res.status(200).json({ generatedAt: now.toISOString(), timezone: DASHBOARD_TIMEZONE, openTickets, waitingForRequester, recentlyUpdated, recentlyResolved });
    } catch (error) {
      console.error("Failed to load the Requester dashboard:", error);
      return res.status(500).json({ error: "Failed to load the dashboard" });
    }
  });

  app.get("/api/dashboard/staff", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const me = req.auth!.user.id;
      const now = dashboardClock.now();
      const open = { currentStatus: { in: [...OPEN_TICKET_STATUSES] } };
      const recent = recentUpdatedFilter(now);
      const [unassigned, assignedToMe, byStatusRows, byPriorityRows, recentlyUpdated, openActionRows, recentActions] = await Promise.all([
        prisma.ticket.count({ where: { ...open, assignedStaffId: null } }),
        prisma.ticket.count({ where: { ...open, assignedStaffId: me } }),
        prisma.ticket.groupBy({ by: ["currentStatus"], _count: { _all: true } }),
        prisma.ticket.groupBy({ by: ["itPriority"], where: open, _count: { _all: true } }),
        prisma.ticket.findMany({ where: recent, orderBy: recentOrder, take: LIMIT, select: ticketBrief }),
        prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`SELECT count(DISTINCT a."ticketId") AS n FROM "ActionTaken" a JOIN "Ticket" t ON t.id = a."ticketId" WHERE a."assigneeId" = ${me} AND a."status" IN ('PLANNED'::"ActionStatus", 'IN_PROGRESS'::"ActionStatus") AND t."currentStatus" IN (${Prisma.join([...OPEN_TICKET_STATUSES])})`),
        prisma.actionTaken.findMany({ where: { performedById: me }, orderBy: [{ actionAt: "desc" }, { id: "desc" }], take: LIMIT, select: { id: true, ticketId: true, status: true, actionAt: true, description: true, ticket: { select: { ticketNumber: true } } } }),
      ]);
      const body: Record<string, unknown> = {
        generatedAt: now.toISOString(), timezone: DASHBOARD_TIMEZONE,
        unassigned, assignedToMe, ticketsWithMyOpenActions: Number(openActionRows[0]?.n ?? 0),
        myRecentActions: recentActions.map((action) => ({ id: action.id, ticketId: action.ticketId, ticketNumber: action.ticket.ticketNumber, status: action.status, actionAt: action.actionAt, description: briefDescription(action.description) })),
        byStatus: countsByKey(ALL_TICKET_STATUSES, byStatusRows.map((row) => ({ key: row.currentStatus, n: row._count._all }))),
        byItPriority: countsByKey(IT_PRIORITIES, byPriorityRows.map((row) => ({ key: row.itPriority, n: row._count._all }))),
        recentlyUpdated,
      };
      if (req.auth!.user.role === "ADMINISTRATOR") {
        const [total, active, inactive, roleRows] = await Promise.all([
          prisma.user.count(), prisma.user.count({ where: { isActive: true } }), prisma.user.count({ where: { isActive: false } }), prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
        ]);
        body.userCounts = { total, active, inactive, byRole: countsByKey(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const, roleRows.map((row) => ({ key: row.role, n: row._count._all }))) };
      }
      return res.status(200).json(body);
    } catch (error) {
      console.error("Failed to load the staff dashboard:", error);
      return res.status(500).json({ error: "Failed to load the dashboard" });
    }
  });
}

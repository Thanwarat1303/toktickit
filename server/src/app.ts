import express, { Request, Response } from "express";
import cors from "cors";
import { Prisma, Priority } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./ticket-number.js";

export const app = express();

app.use(cors());
app.use(express.json());

// Issue 2 - API health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "TokTickIT API",
  });
});

// Issue 4 - Active category list
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    res.status(200).json(categories);
  } catch {
    res.status(500).json({
      message: "Unable to load request categories",
    });
  }
});

// Lab 2, Issue 15 dependency - Active related-system list
// The Create Ticket form must only offer systems that can be used to create a
// ticket. The POST route performs the same check again as the security guard.
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const relatedSystems = await prisma.relatedSystem.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    res.status(200).json(relatedSystems);
  } catch {
    res.status(500).json({
      message: "Unable to load related systems",
    });
  }
});

// Lab 2, Issue 13 - Active Development Requester list
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const requesters = await prisma.requester.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    res.status(200).json(requesters);
  } catch {
    res.status(500).json({
      message: "Unable to load development requesters",
    });
  }
});

// Lab 2, Issue 14 - Create Ticket API
// The selected development requester is passed in X-Requester-Id. In Lab 3
// this temporary header will be replaced by the authenticated user identity.
const priorityValues: Record<string, Priority> = {
  Low: Priority.LOW,
  Medium: Priority.MEDIUM,
  High: Priority.HIGH,
};

const duplicateWindowMs = 60_000;

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function createTicketResponse(ticket: {
  id: number;
  ticketNumber: string;
  currentStatus: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  priority: Priority;
  createdAt: Date;
}) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    status: ticket.currentStatus,
    requesterId: ticket.requesterId,
    categoryId: ticket.categoryId,
    relatedSystemId: ticket.relatedSystemId,
    summary: ticket.summary,
    description: ticket.description,
    priority: ticket.priority[0] + ticket.priority.slice(1).toLowerCase(),
    createdAt: ticket.createdAt,
  };
}

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function queryPositiveInteger(value: unknown): number | undefined {
  const text = queryString(value);
  if (!text || !/^\d+$/.test(text)) return undefined;

  const parsed = Number(text);
  return positiveInteger(parsed) ? parsed : undefined;
}

app.post("/api/tickets", async (req: Request, res: Response) => {
  const requesterId = Number(req.header("X-Requester-Id"));
  const body = req.body ?? {};
  const { categoryId, relatedSystemId, summary, description, priority } = body;

  if (!positiveInteger(requesterId)) {
    return res.status(400).json({ message: "A valid X-Requester-Id is required" });
  }

  if (!positiveInteger(categoryId)) {
    return res.status(400).json({ message: "A valid categoryId is required" });
  }

  if (!positiveInteger(relatedSystemId)) {
    return res.status(400).json({ message: "A valid relatedSystemId is required" });
  }

  if (typeof summary !== "string" || summary.trim().length === 0) {
    return res.status(400).json({ message: "Summary is required" });
  }

  const trimmedSummary = summary.trim();
  if (trimmedSummary.length > 100) {
    return res.status(400).json({ message: "Summary must not exceed 100 characters" });
  }

  if (typeof description !== "string" || description.trim().length === 0) {
    return res.status(400).json({ message: "Description is required" });
  }

  const trimmedDescription = description.trim();
  if (trimmedDescription.length > 2000) {
    return res.status(400).json({ message: "Description must not exceed 2000 characters" });
  }

  if (typeof priority !== "string" || !(priority in priorityValues)) {
    return res.status(400).json({ message: "Priority must be Low, Medium, or High" });
  }

  try {
    const prisma = getPrisma();
    const requestedPriority = priorityValues[priority];

    const result = await prisma.$transaction(async (tx) => {
      const [requester, category, relatedSystem] = await Promise.all([
        tx.requester.findUnique({ where: { id: requesterId } }),
        tx.category.findUnique({ where: { id: categoryId } }),
        tx.relatedSystem.findUnique({ where: { id: relatedSystemId } }),
      ]);

      if (!requester || !category || !relatedSystem) {
        return { kind: "missing-reference" as const };
      }

      if (!requester.isActive || !category.isActive || !relatedSystem.isActive) {
        return { kind: "inactive-reference" as const };
      }

      const recentDuplicate = await tx.ticket.findFirst({
        where: {
          requesterId,
          categoryId,
          relatedSystemId,
          summary: trimmedSummary,
          description: trimmedDescription,
          priority: requestedPriority,
          createdAt: { gte: new Date(Date.now() - duplicateWindowMs) },
        },
      });

      if (recentDuplicate) {
        return { kind: "duplicate" as const };
      }

      // A random placeholder satisfies the database's required unique column.
      // The stable public ticket number is based on the generated database ID.
      const insertedTicket = await tx.ticket.create({
        data: {
          ticketNumber: `PENDING-${randomUUID()}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: trimmedSummary,
          description: trimmedDescription,
          priority: requestedPriority,
          currentStatus: "New",
        },
      });

      const ticket = await tx.ticket.update({
        where: { id: insertedTicket.id },
        data: { ticketNumber: generateTicketNumber(insertedTicket.id) },
      });

      return { kind: "created" as const, ticket };
    });

    if (result.kind === "missing-reference") {
      return res.status(404).json({ message: "Requester, category, or related system was not found" });
    }

    if (result.kind === "inactive-reference") {
      return res.status(400).json({ message: "Requester, category, and related system must be active" });
    }

    if (result.kind === "duplicate") {
      return res.status(409).json({ message: "A matching ticket was submitted recently" });
    }

    return res.status(201).json(createTicketResponse(result.ticket));
  } catch {
    return res.status(500).json({ message: "Unable to create the ticket" });
  }
});

// Lab 2, Issue 16 - My Tickets
// The temporary requester header is deliberately part of this query.  Even if
// somebody changes the URL in the browser, the database query is scoped to the
// selected requester and therefore cannot return another requester's tickets.
app.get("/api/tickets", async (req: Request, res: Response) => {
  const requesterId = Number(req.header("X-Requester-Id"));

  if (!positiveInteger(requesterId)) {
    return res.status(400).json({ message: "A valid X-Requester-Id is required" });
  }

  const search = queryString(req.query.search);
  const status = queryString(req.query.status);
  const categoryIdText = queryString(req.query.categoryId);
  const relatedSystemIdText = queryString(req.query.relatedSystemId);
  const priorityText = queryString(req.query.priority);
  const sortBy = queryString(req.query.sortBy) ?? "createdAt";
  const sortOrder = queryString(req.query.sortOrder) ?? "desc";
  const pageText = queryString(req.query.page);
  const pageSizeText = queryString(req.query.pageSize);

  const categoryId = categoryIdText ? queryPositiveInteger(categoryIdText) : undefined;
  const relatedSystemId = relatedSystemIdText
    ? queryPositiveInteger(relatedSystemIdText)
    : undefined;
  const page = pageText ? queryPositiveInteger(pageText) : 1;
  const pageSize = pageSizeText ? queryPositiveInteger(pageSizeText) : 10;

  if (
    (categoryIdText && !categoryId) ||
    (relatedSystemIdText && !relatedSystemId) ||
    !page ||
    !pageSize ||
    pageSize > 50
  ) {
    return res.status(400).json({ message: "Pagination and reference filters must be positive integers" });
  }

  if (priorityText && !(priorityText in priorityValues)) {
    return res.status(400).json({ message: "Priority must be Low, Medium, or High" });
  }

  if (!["createdAt", "summary", "priority"].includes(sortBy)) {
    return res.status(400).json({ message: "sortBy must be createdAt, summary, or priority" });
  }

  if (sortOrder !== "asc" && sortOrder !== "desc") {
    return res.status(400).json({ message: "sortOrder must be asc or desc" });
  }

  try {
    const prisma = getPrisma();
    const requester = await prisma.requester.findUnique({ where: { id: requesterId } });

    if (!requester) {
      return res.status(404).json({ message: "Requester was not found" });
    }

    if (!requester.isActive) {
      return res.status(400).json({ message: "Requester must be active" });
    }

    const where = {
      requesterId,
      ...(search
        ? {
            OR: [
              { ticketNumber: { contains: search, mode: "insensitive" as const } },
              { summary: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(status ? { currentStatus: status } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(relatedSystemId ? { relatedSystemId } : {}),
      ...(priorityText ? { priority: priorityValues[priorityText] } : {}),
    };

    const direction: Prisma.SortOrder = sortOrder;
    const primaryOrder: Prisma.TicketOrderByWithRelationInput =
      sortBy === "summary"
        ? { summary: direction }
        : sortBy === "priority"
          ? { priority: direction }
          : { createdAt: direction };

    const [tickets, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
        },
        orderBy: [primaryOrder, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    return res.status(200).json({
      items: tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        summary: ticket.summary,
        priority: ticket.priority[0] + ticket.priority.slice(1).toLowerCase(),
        status: ticket.currentStatus,
        category: ticket.category,
        relatedSystem: ticket.relatedSystem,
        createdAt: ticket.createdAt,
      })),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch {
    return res.status(500).json({ message: "Unable to load tickets" });
  }
});

export default app;

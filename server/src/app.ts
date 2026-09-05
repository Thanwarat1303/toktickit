import express, { Request, Response } from "express";
import cors from "cors";
import { Priority } from "@prisma/client";
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

export default app;

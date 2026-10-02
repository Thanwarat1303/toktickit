import express, { Request, Response } from "express";
import cors from "cors";
import { Prisma, Priority } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./ticket-number.js";
import {
  authError,
  clearSessionCookie,
  hashPassword,
  login,
  publicUser,
  requireAuth,
  requireCsrf,
  requirePasswordUpToDate,
  requireRole,
  requireSameOrigin,
  setSessionCookie,
  type AuthenticatedRequest,
} from "./auth.js";

export const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

// Issue 2 - API health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "TokTickIT API",
  });
});

// Issue #30 - Authentication API and server-side sessions.
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !password) {
    return authError(res, 400, "VALIDATION_ERROR", "Email and password are required.");
  }

  try {
    const result = await login(req, email, password);
    if (result.kind === "invalid") return authError(res, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    setSessionCookie(res, result.session.token);
    return res.status(200).json({ user: publicUser(result.user), csrfToken: result.session.csrfToken });
  } catch {
    return authError(res, 500, "AUTH_ERROR", "Unable to sign in.");
  }
});

app.post("/api/auth/logout", requireSameOrigin, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await getPrisma().session.delete({ where: { id: req.auth!.sessionId } });
    clearSessionCookie(res);
    return res.status(204).send();
  } catch {
    return authError(res, 500, "AUTH_ERROR", "Unable to sign out.");
  }
});

app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({ user: publicUser(req.auth!.user), csrfToken: req.auth!.csrfToken });
});

app.post("/api/auth/change-password", requireSameOrigin, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const confirmPassword = typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";
  if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword || newPassword === currentPassword) {
    return authError(res, 400, "VALIDATION_ERROR", "Password must be at least 8 characters, match confirmation, and differ from the current password.");
  }
  try {
    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.default.compare(currentPassword, req.auth!.user.passwordHash);
    if (!valid) return authError(res, 400, "VALIDATION_ERROR", "Current password is incorrect.");
    const passwordHash = await hashPassword(newPassword);
    const user = await getPrisma().user.update({ where: { id: req.auth!.user.id }, data: { passwordHash, mustChangePassword: false } });
    return res.status(200).json({ user: publicUser(user), csrfToken: req.auth!.csrfToken });
  } catch {
    return authError(res, 500, "AUTH_ERROR", "Unable to change password.");
  }
});

// Issue 4 - Active category list
app.get("/api/categories", requireAuth, requirePasswordUpToDate, async (_req: Request, res: Response) => {
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
app.get("/api/related-systems", requireAuth, requirePasswordUpToDate, async (_req: Request, res: Response) => {
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

// The development requester selector is deliberately removed in Lab 3. A
// Requester's profile is resolved from the authenticated User record only.
const priorityValues: Record<string, Priority> = {
  Low: Priority.LOW,
  Medium: Priority.MEDIUM,
  High: Priority.HIGH,
};

const itPriorityValues: Record<string, Priority> = {
  ...priorityValues,
  Urgent: Priority.URGENT,
};

const ticketStatuses = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Resolved",
  "Closed",
  "Reopened",
  "Cancelled",
] as const;

const allowedStaffTransitions: Record<(typeof ticketStatuses)[number], readonly string[]> = {
  New: ["Open", "Cancelled"],
  Open: ["In Progress", "Waiting for Requester", "Cancelled"],
  "In Progress": ["Waiting for Requester", "Resolved", "Cancelled"],
  "Waiting for Requester": ["In Progress", "Resolved", "Cancelled"],
  Resolved: ["Closed", "Reopened"],
  Closed: ["Reopened"],
  Reopened: ["In Progress", "Cancelled"],
  Cancelled: ["Reopened"],
};

const confirmationRequiredStatuses = new Set(["Resolved", "Closed", "Reopened", "Cancelled"]);

function isTicketStatus(value: unknown): value is (typeof ticketStatuses)[number] {
  return typeof value === "string" && ticketStatuses.includes(value as (typeof ticketStatuses)[number]);
}

const duplicateWindowMs = 60_000;
const maxAttachmentSizeBytes = 5 * 1024 * 1024;
const maxMultipartRequestBytes = maxAttachmentSizeBytes + 1024 * 1024;
const maxActiveAttachmentsPerTicket = 5;
const allowedAttachmentMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

interface UploadedMultipartFile {
  originalFilename: string;
  mimeType: string;
  bytes: Buffer;
}

class RequestBodyTooLargeError extends Error {}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function formatPriority(priority: Priority) {
  return priority[0] + priority.slice(1).toLowerCase();
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
    priority: formatPriority(ticket.priority),
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

async function authenticatedRequesterId(req: AuthenticatedRequest): Promise<number | undefined> {
  const requester = await getPrisma().requester.findUnique({
    where: { userId: req.auth!.user.id },
    select: { id: true, isActive: true },
  });
  return requester?.isActive ? requester.id : undefined;
}

function attachmentResponse(attachment: {
  id: number;
  ticketId: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
}) {
  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    originalFilename: attachment.originalFilename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt,
    removedAt: attachment.removedAt,
    removalReason: attachment.removalReason,
  };
}

function safeOriginalFilename(filename: string) {
  const baseName = path.basename(filename).trim();
  const cleaned = baseName.replace(/[^\w .()-]/g, "_");
  return cleaned || "attachment";
}

function multipartBoundary(req: Request) {
  const contentType = req.header("content-type") ?? "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return boundaryMatch?.[1] ?? boundaryMatch?.[2];
}

function collectRequestBody(req: Request, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let receivedBytes = 0;
    let exceededLimit = false;

    req.on("data", (chunk: Buffer | string) => {
      if (exceededLimit) {
        return;
      }

      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += buffer.length;

      if (receivedBytes > maxBytes) {
        exceededLimit = true;
        reject(new RequestBodyTooLargeError());
        return;
      }

      chunks.push(buffer);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipartFile(req: Request, body: Buffer): UploadedMultipartFile | undefined {
  const boundary = multipartBoundary(req);
  if (!boundary) return undefined;

  const bodyText = body.toString("latin1");
  const parts = bodyText.split(`--${boundary}`);

  for (const part of parts) {
    if (!part.includes('name="file"')) continue;

    const [rawHeaders, ...contentParts] = part.split("\r\n\r\n");
    if (!rawHeaders || contentParts.length === 0) return undefined;

    const filenameMatch = rawHeaders.match(/filename="([^"]*)"/i);
    const typeMatch = rawHeaders.match(/content-type:\s*([^\r\n]+)/i);
    const submittedFilename = filenameMatch?.[1]?.trim() ?? "";
    if (!submittedFilename) return undefined;

    const originalFilename = safeOriginalFilename(submittedFilename);
    const mimeType = typeMatch?.[1]?.trim().toLowerCase() ?? "application/octet-stream";
    const contentText = contentParts.join("\r\n\r\n").replace(/\r\n$/, "");

    return {
      originalFilename,
      mimeType,
      bytes: Buffer.from(contentText, "latin1"),
    };
  }

  return undefined;
}

app.post("/api/tickets", requireSameOrigin, requireAuth, requireRole("REQUESTER"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = await authenticatedRequesterId(req);
  const body = req.body ?? {};
  const { categoryId, relatedSystemId, summary, description, priority } = body;

  if (!requesterId) {
    return authError(res, 403, "FORBIDDEN", "Requester profile is not available.");
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
app.get("/api/tickets", requireAuth, requireRole("REQUESTER"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = await authenticatedRequesterId(req);

  if (!requesterId) {
    return authError(res, 403, "FORBIDDEN", "Requester profile is not available.");
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
        priority: formatPriority(ticket.priority),
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

// Issue #33 — the shared IT Staff queue is deliberately independent of the
// Requester profile.  Staff identity comes solely from the signed-in session;
// it never accepts a client-supplied requester or staff id as authority.
app.get("/api/staff/tickets", requireAuth, requireRole("IT_STAFF"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const search = queryString(req.query.search);
  const categoryIdText = queryString(req.query.categoryId);
  const relatedSystemIdText = queryString(req.query.relatedSystemId);
  const itPriorityText = queryString(req.query.itPriority);
  const status = queryString(req.query.status);
  const ownerIdText = queryString(req.query.ownerId);
  const sortBy = queryString(req.query.sortBy) ?? "createdAt";
  const sortDir = queryString(req.query.sortDir) ?? "desc";
  const pageText = queryString(req.query.page);
  const pageSizeText = queryString(req.query.pageSize);
  const categoryId = categoryIdText ? queryPositiveInteger(categoryIdText) : undefined;
  const relatedSystemId = relatedSystemIdText ? queryPositiveInteger(relatedSystemIdText) : undefined;
  const ownerId = ownerIdText === "0" ? 0 : ownerIdText ? queryPositiveInteger(ownerIdText) : undefined;
  const page = pageText ? queryPositiveInteger(pageText) : 1;
  const pageSize = pageSizeText ? queryPositiveInteger(pageSizeText) : 20;

  if ((categoryIdText && !categoryId) || (relatedSystemIdText && !relatedSystemId) || (ownerIdText && ownerId === undefined) || !page || !pageSize || pageSize > 50) {
    return res.status(400).json({ message: "Pagination and filters must use valid positive integers (ownerId 0 means unassigned)" });
  }
  if (itPriorityText && !(itPriorityText in itPriorityValues)) {
    return res.status(400).json({ message: "itPriority must be Low, Medium, High, or Urgent" });
  }
  if (status && !isTicketStatus(status)) {
    return res.status(400).json({ message: "status is not valid" });
  }
  if (!["createdAt", "updatedAt", "itPriority", "status"].includes(sortBy) || !["asc", "desc"].includes(sortDir)) {
    return res.status(400).json({ message: "sortBy and sortDir are not valid" });
  }

  try {
    const where: Prisma.TicketWhereInput = {
      ...(search ? { OR: [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ] } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(relatedSystemId ? { relatedSystemId } : {}),
      ...(itPriorityText ? { itPriority: itPriorityValues[itPriorityText] } : {}),
      ...(status ? { currentStatus: status } : {}),
      ...(ownerId === 0 ? { assignedStaffId: null } : ownerId ? { assignedStaffId: ownerId } : {}),
    };
    const direction: Prisma.SortOrder = sortDir as Prisma.SortOrder;
    const orderBy: Prisma.TicketOrderByWithRelationInput =
      sortBy === "updatedAt" ? { updatedAt: direction } :
      sortBy === "itPriority" ? { itPriority: direction } :
      sortBy === "status" ? { currentStatus: direction } : { createdAt: direction };
    const prisma = getPrisma();
    const [tickets, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where, orderBy: [orderBy, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize,
        include: {
          requester: { select: { id: true, name: true } },
          assignedStaff: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);
    return res.status(200).json({
      tickets: tickets.map((ticket) => ({
        id: ticket.id, ticketNumber: ticket.ticketNumber, summary: ticket.summary,
        priority: formatPriority(ticket.priority), itPriority: formatPriority(ticket.itPriority),
        status: ticket.currentStatus, category: ticket.category, relatedSystem: ticket.relatedSystem,
        requesterName: ticket.requester.name,
        owner: ticket.assignedStaff ? { id: ticket.assignedStaff.id, name: ticket.assignedStaff.name } : null,
        createdAt: ticket.createdAt, updatedAt: ticket.updatedAt,
      })),
      pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) },
    });
  } catch {
    return res.status(500).json({ message: "Unable to load the staff ticket queue" });
  }
});

// Issue #34 — operational ticket actions are scoped to authenticated IT Staff.
// The browser never chooses the claiming identity; it is always req.auth.user.
app.get("/api/staff/tickets/:ticketId", requireAuth, requireRole("IT_STAFF"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });

  try {
    const ticket = await getPrisma().ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        assignedStaff: { select: { id: true, name: true, email: true } },
        attachments: {
          select: { id: true, ticketId: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true, removedAt: true, removalReason: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        comments: { include: { author: { select: { id: true, name: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        internalNotes: { include: { author: { select: { id: true, name: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    });
    if (!ticket) return res.status(404).json({ message: "Ticket was not found" });

    return res.status(200).json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      requester: ticket.requester,
      category: ticket.category,
      relatedSystem: ticket.relatedSystem,
      summary: ticket.summary,
      description: ticket.description,
      priority: formatPriority(ticket.priority),
      itPriority: formatPriority(ticket.itPriority),
      status: ticket.currentStatus,
      owner: ticket.assignedStaff,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      attachments: ticket.attachments.map(attachmentResponse),
      publicComments: ticket.comments.map((comment) => ({ id: comment.id, ticketId: comment.ticketId, author: comment.author, content: comment.body, createdAt: comment.createdAt })),
      internalNotes: ticket.internalNotes.map((note) => ({ id: note.id, ticketId: note.ticketId, author: note.author, content: note.body, createdAt: note.createdAt })),
    });
  } catch {
    return res.status(500).json({ message: "Unable to load staff ticket details" });
  }
});

app.post("/api/staff/tickets/:ticketId/claim", requireSameOrigin, requireAuth, requireRole("IT_STAFF"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });

  try {
    const prisma = getPrisma();
    const result = await prisma.ticket.updateMany({ where: { id: ticketId, assignedStaffId: null }, data: { assignedStaffId: req.auth!.user.id } });
    if (result.count === 1) {
      const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { assignedStaff: { select: { id: true, name: true } } } });
      return res.status(200).json({ id: ticket.id, owner: ticket.assignedStaff, updatedAt: ticket.updatedAt });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { assignedStaff: { select: { id: true, name: true } } } });
    if (!ticket) return res.status(404).json({ message: "Ticket was not found" });
    if (ticket.assignedStaffId === req.auth!.user.id) return res.status(200).json({ id: ticket.id, owner: ticket.assignedStaff, updatedAt: ticket.updatedAt });
    return res.status(409).json({ message: "Ticket is already claimed by another staff member" });
  } catch {
    return res.status(500).json({ message: "Unable to claim ticket" });
  }
});

app.patch("/api/staff/tickets/:ticketId/owner", requireSameOrigin, requireAuth, requireRole("IT_STAFF"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const ownerId = req.body?.ownerId;
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });
  if (ownerId !== null && !positiveInteger(ownerId)) return res.status(400).json({ message: "ownerId must be an active IT Staff id or null" });

  try {
    const prisma = getPrisma();
    if (ownerId !== null) {
      const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { role: true, isActive: true } });
      if (!owner || !owner.isActive || owner.role !== "IT_STAFF") {
        return res.status(400).json({ message: "ownerId must identify an active IT Staff user" });
      }
    }

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { assignedStaffId: ownerId },
      include: { assignedStaff: { select: { id: true, name: true } } },
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    });
    if (!ticket) return res.status(404).json({ message: "Ticket was not found" });
    return res.status(200).json({ id: ticket.id, owner: ticket.assignedStaff, updatedAt: ticket.updatedAt });
  } catch {
    return res.status(500).json({ message: "Unable to update ticket owner" });
  }
});

app.patch("/api/staff/tickets/:ticketId/workflow", requireSameOrigin, requireAuth, requireRole("IT_STAFF"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const body = req.body ?? {};
  const hasItPriority = Object.prototype.hasOwnProperty.call(body, "itPriority");
  const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
  const itPriority = body.itPriority;
  const status = body.status;
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });
  if (!hasItPriority && !hasStatus) return res.status(400).json({ message: "Provide itPriority, status, or both" });
  if (hasItPriority && (typeof itPriority !== "string" || !(itPriority in itPriorityValues))) {
    return res.status(400).json({ message: "itPriority must be Low, Medium, High, or Urgent" });
  }
  if (hasStatus && !isTicketStatus(status)) return res.status(400).json({ message: "status is not valid" });
  if (hasStatus && confirmationRequiredStatuses.has(status) && body.confirm !== true) {
    return res.status(400).json({ message: `Changing a ticket to ${status} requires confirm: true` });
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, currentStatus: true } });
    if (!ticket) return res.status(404).json({ message: "Ticket was not found" });
    if (hasStatus && !allowedStaffTransitions[ticket.currentStatus as (typeof ticketStatuses)[number]]?.includes(status)) {
      return res.status(409).json({ message: `Cannot transition from ${ticket.currentStatus} to ${status}` });
    }

    const update = await prisma.ticket.updateMany({
      where: { id: ticketId, ...(hasStatus ? { currentStatus: ticket.currentStatus } : {}) },
      data: {
        ...(hasItPriority ? { itPriority: itPriorityValues[itPriority] } : {}),
        ...(hasStatus ? { currentStatus: status } : {}),
      },
    });
    if (update.count !== 1) return res.status(409).json({ message: "Ticket workflow was changed by another request; refresh and try again" });
    const updatedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { id: true, itPriority: true, currentStatus: true, updatedAt: true } });
    return res.status(200).json({ id: updatedTicket.id, itPriority: formatPriority(updatedTicket.itPriority), status: updatedTicket.currentStatus, updatedAt: updatedTicket.updatedAt });
  } catch {
    return res.status(500).json({ message: "Unable to update ticket workflow" });
  }
});

// Issue #35 — communication is deliberately separate from workflow actions.
// Requesters may access only their own ticket; IT Staff can access the shared
// queue.  Internal notes never pass through a Requester response path.
const communicationLimit = 2000;
async function canAccessTicketCommunication(req: AuthenticatedRequest, ticketId: number, allowRequester: boolean) {
  const role = req.auth!.user.role;
  if (role === "IT_STAFF" || role === "ADMINISTRATOR") return true;
  if (!allowRequester || role !== "REQUESTER") return false;
  const requesterId = await authenticatedRequesterId(req);
  return !!requesterId && !!(await getPrisma().ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } }));
}
function communicationBody(value: unknown) {
  if (typeof value !== "string") return undefined;
  const content = value.trim();
  return content.length > 0 && content.length <= communicationLimit ? content : undefined;
}
function communicationResponse(entry: { id: number; ticketId: number; body: string; createdAt: Date; author: { id: number; name: string } }) {
  return { id: entry.id, ticketId: entry.ticketId, author: entry.author, content: entry.body, createdAt: entry.createdAt };
}

app.get("/api/tickets/:ticketId/comments", requireAuth, requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });
  try {
    const prisma = getPrisma();
    if (!(await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } }))) return res.status(404).json({ message: "Ticket was not found" });
    if (!(await canAccessTicketCommunication(req, ticketId, true))) return authError(res, req.auth!.user.role === "REQUESTER" ? 404 : 403, "FORBIDDEN", "Ticket was not found");
    const comments = await prisma.ticketComment.findMany({ where: { ticketId }, include: { author: { select: { id: true, name: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return res.status(200).json(comments.map(communicationResponse));
  } catch { return res.status(500).json({ message: "Unable to load comments" }); }
});

app.post("/api/tickets/:ticketId/comments", requireSameOrigin, requireAuth, requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId); const content = communicationBody(req.body?.content);
  if (!positiveInteger(ticketId) || !content) return res.status(400).json({ message: "Comment content must be 1 to 2000 characters." });
  try {
    const prisma = getPrisma();
    if (!(await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } }))) return res.status(404).json({ message: "Ticket was not found" });
    if (req.auth!.user.role === "ADMINISTRATOR" || !(await canAccessTicketCommunication(req, ticketId, true))) return authError(res, req.auth!.user.role === "REQUESTER" ? 404 : 403, "FORBIDDEN", "You do not have permission to post this comment.");
    const comment = await prisma.ticketComment.create({ data: { ticketId, authorId: req.auth!.user.id, body: content }, include: { author: { select: { id: true, name: true } } } });
    return res.status(201).json(communicationResponse(comment));
  } catch { return res.status(500).json({ message: "Unable to post comment" }); }
});

app.get("/api/tickets/:ticketId/notes", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });
  try { const prisma = getPrisma(); const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } }); if (!ticket) return res.status(404).json({ message: "Ticket was not found" }); const notes = await prisma.internalNote.findMany({ where: { ticketId }, include: { author: { select: { id: true, name: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }); return res.status(200).json(notes.map(communicationResponse)); } catch { return res.status(500).json({ message: "Unable to load notes" }); }
});

app.post("/api/tickets/:ticketId/notes", requireSameOrigin, requireAuth, requireRole("IT_STAFF"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId); const content = communicationBody(req.body?.content);
  if (!positiveInteger(ticketId) || !content) return res.status(400).json({ message: "Note content must be 1 to 2000 characters." });
  try { const prisma = getPrisma(); const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } }); if (!ticket) return res.status(404).json({ message: "Ticket was not found" }); const note = await prisma.internalNote.create({ data: { ticketId, authorId: req.auth!.user.id, body: content }, include: { author: { select: { id: true, name: true } } } }); return res.status(201).json(communicationResponse(note)); } catch { return res.status(500).json({ message: "Unable to post note" }); }
});

// Lab 2, Issue 17 - Ticket detail and attachment inspection
app.get("/api/tickets/:ticketId", requireAuth, requireRole("REQUESTER"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = await authenticatedRequesterId(req);
  const ticketId = Number(req.params.ticketId);

  if (!requesterId) {
    return authError(res, 403, "FORBIDDEN", "Requester profile is not available.");
  }

  if (!positiveInteger(ticketId)) {
    return res.status(400).json({ message: "A valid ticket id is required" });
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
      },
    });

    if (!ticket) {
      return res.status(404).json({ message: "Ticket was not found" });
    }

    if (ticket.requesterId !== requesterId) {
      return res.status(404).json({ message: "Ticket was not found" });
    }

    return res.status(200).json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      requester: ticket.requester,
      category: ticket.category,
      relatedSystem: ticket.relatedSystem,
      summary: ticket.summary,
      description: ticket.description,
      priority: formatPriority(ticket.priority),
      status: ticket.currentStatus,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    });
  } catch {
    return res.status(500).json({ message: "Unable to load ticket details" });
  }
});

app.get("/api/tickets/:ticketId/attachments", requireAuth, requireRole("REQUESTER"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = await authenticatedRequesterId(req);
  const ticketId = Number(req.params.ticketId);

  if (!requesterId) {
    return authError(res, 403, "FORBIDDEN", "Requester profile is not available.");
  }

  if (!positiveInteger(ticketId)) {
    return res.status(400).json({ message: "A valid ticket id is required" });
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { requesterId: true },
    });

    if (!ticket) {
      return res.status(404).json({ message: "Ticket was not found" });
    }

    if (ticket.requesterId !== requesterId) {
      return res.status(404).json({ message: "Ticket was not found" });
    }

    const attachments = await prisma.attachment.findMany({
      where: { ticketId },
      select: {
        id: true,
        ticketId: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        removedAt: true,
        removalReason: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return res.status(200).json(attachments.map(attachmentResponse));
  } catch {
    return res.status(500).json({ message: "Unable to load attachments" });
  }
});

app.post("/api/tickets/:ticketId/attachments", requireSameOrigin, requireAuth, requireRole("REQUESTER"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = await authenticatedRequesterId(req);
  const ticketId = Number(req.params.ticketId);

  if (!requesterId) {
    return authError(res, 403, "FORBIDDEN", "Requester profile is not available.");
  }

  if (!positiveInteger(ticketId)) {
    return res.status(400).json({ message: "A valid ticket id is required" });
  }

  try {
    const uploadedFile = parseMultipartFile(req, await collectRequestBody(req, maxMultipartRequestBytes));

    if (!uploadedFile || uploadedFile.bytes.length === 0) {
      return res.status(400).json({ message: "A file is required" });
    }

    if (!allowedAttachmentMimeTypes.has(uploadedFile.mimeType)) {
      return res.status(415).json({
        message: "Unsupported attachment type. Use JPG, PNG, WEBP, or PDF.",
      });
    }

    if (uploadedFile.bytes.length > maxAttachmentSizeBytes) {
      return res.status(413).json({ message: "Attachment must not exceed 5 MB" });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { requesterId: true },
    });

    if (!ticket) {
      return res.status(404).json({ message: "Ticket was not found" });
    }

    if (ticket.requesterId !== requesterId) {
      return res.status(404).json({ message: "Ticket was not found" });
    }

    const activeAttachmentCount = await prisma.attachment.count({
      where: {
        ticketId,
        removedAt: null,
      },
    });

    if (activeAttachmentCount >= maxActiveAttachmentsPerTicket) {
      return res.status(409).json({ message: "A ticket can have at most five active attachments" });
    }

    const uploadRoot = path.resolve(process.cwd(), "uploads");
    mkdirSync(uploadRoot, { recursive: true });

    const storedFilename = `${randomUUID()}-${uploadedFile.originalFilename}`;
    writeFileSync(path.join(uploadRoot, storedFilename), uploadedFile.bytes);

    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        originalFilename: uploadedFile.originalFilename,
        storedFilename,
        mimeType: uploadedFile.mimeType,
        sizeBytes: uploadedFile.bytes.length,
      },
      select: {
        id: true,
        ticketId: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        removedAt: true,
        removalReason: true,
      },
    });

    return res.status(201).json(attachmentResponse(attachment));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return res.status(413).json({ message: "Attachment must not exceed 5 MB" });
    }

    return res.status(500).json({ message: "Unable to upload attachment" });
  }
});

app.get("/api/attachments/:attachmentId/download", requireAuth, requireRole("REQUESTER"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = await authenticatedRequesterId(req);
  const attachmentId = Number(req.params.attachmentId);

  if (!requesterId) {
    return authError(res, 403, "FORBIDDEN", "Requester profile is not available.");
  }

  if (!positiveInteger(attachmentId)) {
    return res.status(400).json({ message: "A valid attachment id is required" });
  }

  try {
    const prisma = getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { requesterId: true } } },
    });

    if (!attachment) {
      return res.status(404).json({ message: "Attachment was not found" });
    }

    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(404).json({ message: "Attachment was not found" });
    }

    if (attachment.removedAt) {
      return res.status(410).json({ message: "This attachment has been removed" });
    }

    const uploadRoot = path.resolve(process.cwd(), "uploads");
    const filePath = path.resolve(uploadRoot, attachment.storedFilename);

    if (!filePath.startsWith(uploadRoot) || !existsSync(filePath)) {
      return res.status(404).json({ message: "Attachment file was not found" });
    }

    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${attachment.originalFilename.replaceAll('"', "")}"`);
    return res.sendFile(filePath);
  } catch {
    return res.status(500).json({ message: "Unable to download attachment" });
  }
});

app.delete("/api/attachments/:attachmentId", requireSameOrigin, requireAuth, requireRole("REQUESTER"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = await authenticatedRequesterId(req);
  const attachmentId = Number(req.params.attachmentId);
  const removalReason = typeof req.body?.removalReason === "string" ? req.body.removalReason.trim() : "";

  if (!requesterId) {
    return authError(res, 403, "FORBIDDEN", "Requester profile is not available.");
  }

  if (!positiveInteger(attachmentId)) {
    return res.status(400).json({ message: "A valid attachment id is required" });
  }

  if (!removalReason) {
    return res.status(400).json({ message: "A removal reason is required" });
  }

  try {
    const prisma = getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { requesterId: true } } },
    });

    if (!attachment) {
      return res.status(404).json({ message: "Attachment was not found" });
    }

    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(404).json({ message: "Attachment was not found" });
    }

    if (attachment.removedAt) {
      return res.status(409).json({ message: "This attachment has already been removed" });
    }

    const updatedAttachment = await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        removedAt: new Date(),
        removalReason,
      },
      select: {
        id: true,
        ticketId: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        removedAt: true,
        removalReason: true,
      },
    });

    return res.status(200).json(attachmentResponse(updatedAttachment));
  } catch {
    return res.status(500).json({ message: "Unable to remove attachment" });
  }
});

export default app;

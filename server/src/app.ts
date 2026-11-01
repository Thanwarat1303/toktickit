import express, { Request, Response } from "express";
import cors from "cors";
import { ActionStatus, Prisma, Priority } from "@prisma/client";
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
  validRole,
  type AuthenticatedRequest,
} from "./auth.js";
import { OPEN_TICKET_STATUSES, recentUpdatedFilter, registerDashboardRoutes } from "./dashboard.js";

export const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

registerDashboardRoutes(app);

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

type ResolutionGateReason = "NO_OWNER" | "NO_COMPLETED_ACTION" | "OPEN_ACTIONS";

function resolutionGate(ownerId: number | null, actions: Array<{ status: ActionStatus }>) {
  const unmet: ResolutionGateReason[] = [];
  if (ownerId === null) unmet.push("NO_OWNER");
  if (!actions.some((action) => action.status === ActionStatus.COMPLETED)) unmet.push("NO_COMPLETED_ACTION");
  if (actions.some((action) => action.status === ActionStatus.PLANNED || action.status === ActionStatus.IN_PROGRESS)) unmet.push("OPEN_ACTIONS");
  return { ok: unmet.length === 0, unmet };
}

function allowedTransitions(status: string) {
  return [...(allowedStaffTransitions[status as (typeof ticketStatuses)[number]] ?? [])];
}

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
  const recentText = queryString(req.query.recent);

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
    pageSize > 50 ||
    (recentText !== undefined && recentText !== "1")
  ) {
    return res.status(400).json({ message: "Pagination and reference filters must be positive integers" });
  }

  if (priorityText && !(priorityText in priorityValues)) {
    return res.status(400).json({ message: "Priority must be Low, Medium, or High" });
  }

  if (!["createdAt", "updatedAt", "summary", "priority"].includes(sortBy)) {
    return res.status(400).json({ message: "sortBy must be createdAt, updatedAt, summary, or priority" });
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
      ...(recentText === "1" ? recentUpdatedFilter() : {}),
    };

    const direction: Prisma.SortOrder = sortOrder;
    const primaryOrder: Prisma.TicketOrderByWithRelationInput =
      sortBy === "summary"
        ? { summary: direction }
        : sortBy === "priority"
          ? { priority: direction }
        : sortBy === "updatedAt"
          ? { updatedAt: direction }
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
app.get("/api/staff/tickets", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const search = queryString(req.query.search);
  const categoryIdText = queryString(req.query.categoryId);
  const relatedSystemIdText = queryString(req.query.relatedSystemId);
  const itPriorityText = queryString(req.query.itPriority);
  const status = queryString(req.query.status);
  const ownerIdText = queryString(req.query.ownerId);
  const actionAssigneeIdText = queryString(req.query.actionAssigneeId);
  const openText = queryString(req.query.open);
  const recentText = queryString(req.query.recent);
  const sortBy = queryString(req.query.sortBy) ?? "createdAt";
  const sortDir = queryString(req.query.sortDir) ?? "desc";
  const pageText = queryString(req.query.page);
  const pageSizeText = queryString(req.query.pageSize);
  const categoryId = categoryIdText ? queryPositiveInteger(categoryIdText) : undefined;
  const relatedSystemId = relatedSystemIdText ? queryPositiveInteger(relatedSystemIdText) : undefined;
  const ownerId = ownerIdText === "0" || ownerIdText === "unassigned" ? 0 : ownerIdText === "me" ? req.auth!.user.id : ownerIdText ? queryPositiveInteger(ownerIdText) : undefined;
  const page = pageText ? queryPositiveInteger(pageText) : 1;
  const pageSize = pageSizeText ? queryPositiveInteger(pageSizeText) : 20;

  if ((categoryIdText && !categoryId) || (relatedSystemIdText && !relatedSystemId) || (ownerIdText && ownerId === undefined) || (actionAssigneeIdText !== undefined && actionAssigneeIdText !== "me") || (openText !== undefined && openText !== "1") || (recentText !== undefined && recentText !== "1") || !page || !pageSize || pageSize > 50) {
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
      ...(openText === "1" ? { currentStatus: { in: [...OPEN_TICKET_STATUSES] } } : {}),
      ...(recentText === "1" ? recentUpdatedFilter() : {}),
      ...(actionAssigneeIdText === "me" ? { actionsTaken: { some: { assigneeId: req.auth!.user.id, status: { in: ["PLANNED", "IN_PROGRESS"] } } } } : {}),
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

// A detail screen needs a safe, canonical list of people who may own a ticket.
// It is deliberately an IT Staff-only lookup and exposes only the fields needed
// to make an assignment; it must appear before the :ticketId route below.
app.get("/api/staff/assignable-users", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await getPrisma().user.findMany({
      where: { role: { in: ["IT_STAFF", "ADMINISTRATOR"] }, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return res.status(200).json(users);
  } catch {
    return res.status(500).json({ message: "Unable to load assignable staff" });
  }
});

// Issue #34 — operational ticket actions are scoped to authenticated IT Staff.
// The browser never chooses the claiming identity; it is always req.auth.user.
app.get("/api/staff/tickets/:ticketId", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
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
        actionsTaken: { select: { status: true } },
      },
    });
    if (!ticket) return res.status(404).json({ message: "Ticket was not found" });

    return res.status(200).json({
      id: ticket.id,
      version: ticket.version,
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
      allowedTransitions: allowedTransitions(ticket.currentStatus),
      resolutionGate: resolutionGate(ticket.assignedStaffId, ticket.actionsTaken),
      attachments: ticket.attachments.map(attachmentResponse),
      publicComments: ticket.comments.map((comment) => ({ id: comment.id, ticketId: comment.ticketId, author: comment.author, content: comment.body, createdAt: comment.createdAt })),
      internalNotes: ticket.internalNotes.map((note) => ({ id: note.id, ticketId: note.ticketId, author: note.author, content: note.body, createdAt: note.createdAt })),
    });
  } catch {
    return res.status(500).json({ message: "Unable to load staff ticket details" });
  }
});

app.post("/api/staff/tickets/:ticketId/claim", requireSameOrigin, requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const version = req.body?.version;
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });
  if (!positiveInteger(version)) return res.status(400).json({ error: "Validation failed.", errors: { version: "A current integer version is required." } });

  try {
    const prisma = getPrisma();
    const result = await prisma.ticket.updateMany({ where: { id: ticketId, assignedStaffId: null, version }, data: { assignedStaffId: req.auth!.user.id, version: { increment: 1 } } });
    if (result.count === 1) {
      const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { assignedStaff: { select: { id: true, name: true } } } });
      return res.status(200).json({ id: ticket.id, owner: ticket.assignedStaff, version: ticket.version, updatedAt: ticket.updatedAt });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { assignedStaff: { select: { id: true, name: true } } } });
    if (!ticket) return res.status(404).json({ message: "Ticket was not found" });
    if (ticket.version !== version) return res.status(409).json({ error: "This ticket was changed by another request; refresh and try again.", code: "STALE_VERSION", currentVersion: ticket.version });
    if (ticket.assignedStaffId === req.auth!.user.id) return res.status(200).json({ id: ticket.id, owner: ticket.assignedStaff, version: ticket.version, updatedAt: ticket.updatedAt });
    return res.status(409).json({ message: "Ticket is already claimed by another staff member" });
  } catch {
    return res.status(500).json({ message: "Unable to claim ticket" });
  }
});

app.patch("/api/staff/tickets/:ticketId/owner", requireSameOrigin, requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const ownerId = req.body?.ownerId;
  const version = req.body?.version;
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });
  if (ownerId !== null && !positiveInteger(ownerId)) return res.status(400).json({ message: "ownerId must be an active IT Staff id or null" });
  if (!positiveInteger(version)) return res.status(400).json({ error: "Validation failed.", errors: { version: "A current integer version is required." } });

  try {
    const prisma = getPrisma();
    // BR-14 requires body validation (400) before ticket lookup/staleness.
    // Keep this early check, then repeat it under the ticket lock before the
    // write so a concurrent account change cannot make an invalid owner stick.
    if (ownerId !== null) {
      const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { role: true, isActive: true } });
      if (!owner || !owner.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(owner.role)) {
        return res.status(400).json({ message: "ownerId must identify an active IT Staff or Administrator user" });
      }
    }
    const outcome = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number; currentStatus: string; version: number }>>(
        Prisma.sql`SELECT "id", "currentStatus", "version" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`,
      );
      const ticket = locked[0];
      if (!ticket) return { kind: "missing" as const };
      if (ticket.version !== version) return { kind: "stale" as const, currentVersion: ticket.version };
      // Resolved tickets and their terminal Closed successors retain an owner.
      // Reopen before unassigning so no completed workflow loses accountability.
      if (ownerId === null && ["Resolved", "Closed"].includes(ticket.currentStatus)) return { kind: "ownerRequired" as const };

      if (ownerId !== null) {
        const owner = await tx.user.findUnique({ where: { id: ownerId }, select: { role: true, isActive: true } });
        if (!owner || !owner.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(owner.role)) return { kind: "invalidOwner" as const };
      }

      const update = await tx.ticket.updateMany({ where: { id: ticketId, version }, data: { assignedStaffId: ownerId, version: { increment: 1 } } });
      if (update.count !== 1) {
        const current = await tx.ticket.findUnique({ where: { id: ticketId }, select: { version: true } });
        return { kind: "stale" as const, currentVersion: current?.version ?? version };
      }
      return { kind: "updated" as const };
    });
    if (outcome.kind === "missing") return res.status(404).json({ message: "Ticket was not found" });
    if (outcome.kind === "stale") return res.status(409).json({ error: "This ticket was changed by another request; refresh and try again.", code: "STALE_VERSION", currentVersion: outcome.currentVersion });
    if (outcome.kind === "invalidOwner") return res.status(400).json({ message: "ownerId must identify an active IT Staff or Administrator user" });
    if (outcome.kind === "ownerRequired") return res.status(409).json({ error: "Reopen the ticket before removing its owner.", code: "RESOLUTION_GATE", unmet: ["NO_OWNER"] });
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { assignedStaff: { select: { id: true, name: true } } } });
    return res.status(200).json({ id: ticket.id, owner: ticket.assignedStaff, version: ticket.version, updatedAt: ticket.updatedAt });
  } catch {
    return res.status(500).json({ message: "Unable to update ticket owner" });
  }
});

app.patch("/api/staff/tickets/:ticketId/workflow", requireSameOrigin, requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const body = req.body ?? {};
  const hasItPriority = Object.prototype.hasOwnProperty.call(body, "itPriority");
  const itPriority = body.itPriority;
  const version = body.version;
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });
  if (!positiveInteger(version)) return res.status(400).json({ error: "Validation failed.", errors: { version: "A current integer version is required." } });
  if (Object.prototype.hasOwnProperty.call(body, "status") || Object.prototype.hasOwnProperty.call(body, "confirm")) {
    return res.status(400).json({ error: "Validation failed.", errors: {
      ...(Object.prototype.hasOwnProperty.call(body, "status") ? { status: "Use the dedicated status endpoint." } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "confirm") ? { confirm: "Confirmation belongs to the dedicated status endpoint." } : {}),
    } });
  }
  if (!hasItPriority) return res.status(400).json({ message: "Provide itPriority." });
  if (hasItPriority && (typeof itPriority !== "string" || !(itPriority in itPriorityValues))) {
    return res.status(400).json({ message: "itPriority must be Low, Medium, High, or Urgent" });
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, version: true } });
    if (!ticket) return res.status(404).json({ message: "Ticket was not found" });

    const update = await prisma.ticket.updateMany({
      where: { id: ticketId, version },
      data: {
        itPriority: itPriorityValues[itPriority],
        version: { increment: 1 },
      },
    });
    if (update.count !== 1) { const current = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { version: true } }); return res.status(409).json({ error: "This ticket was changed by another request; refresh and try again.", code: "STALE_VERSION", currentVersion: current?.version ?? version }); }
    const updatedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { id: true, itPriority: true, currentStatus: true, version: true, updatedAt: true } });
    return res.status(200).json({ id: updatedTicket.id, itPriority: formatPriority(updatedTicket.itPriority), status: updatedTicket.currentStatus, version: updatedTicket.version, updatedAt: updatedTicket.updatedAt });
  } catch {
    return res.status(500).json({ message: "Unable to update ticket workflow" });
  }
});

// Lab 4, Issue #61 — status changes are deliberately separate from IT-priority
// edits. The Ticket row remains locked while the transition matrix and the
// resolution gate are evaluated, so an Action Taken write cannot slip between
// the gate check and a successful transition to Resolved.
app.patch("/api/staff/tickets/:ticketId/status", requireSameOrigin, requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const targetStatus = req.body?.currentStatus;
  const version = req.body?.version;
  if (!positiveInteger(ticketId)) return res.status(400).json({ error: "Validation failed.", errors: { ticketId: "A valid ticket id is required." } });
  if (!positiveInteger(version)) return res.status(400).json({ error: "Validation failed.", errors: { version: "A current integer version is required." } });
  if (!isTicketStatus(targetStatus)) return res.status(400).json({ error: "Validation failed.", errors: { currentStatus: "A valid ticket status is required." } });
  if (confirmationRequiredStatuses.has(targetStatus) && req.body?.confirm !== true) {
    return res.status(400).json({ error: "Validation failed.", errors: { confirm: `Changing a ticket to ${targetStatus} requires confirm: true.` } });
  }

  try {
    const outcome = await getPrisma().$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number; currentStatus: string; assignedStaffId: number | null; version: number }>>(
        Prisma.sql`SELECT "id", "currentStatus", "assignedStaffId", "version" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`,
      );
      const ticket = locked[0];
      if (!ticket) return { kind: "missing" as const };
      if (ticket.version !== version) return { kind: "stale" as const, currentVersion: ticket.version };
      if (!allowedTransitions(ticket.currentStatus).includes(targetStatus)) {
        return { kind: "illegal" as const, currentStatus: ticket.currentStatus };
      }

      const actions = await tx.actionTaken.findMany({ where: { ticketId }, select: { status: true } });
      const gate = resolutionGate(ticket.assignedStaffId, actions);
      if (targetStatus === "Resolved" && !gate.ok) return { kind: "gate" as const, gate };

      const update = await tx.ticket.updateMany({
        where: { id: ticketId, version },
        data: { currentStatus: targetStatus, version: { increment: 1 } },
      });
      if (update.count !== 1) {
        const current = await tx.ticket.findUnique({ where: { id: ticketId }, select: { version: true } });
        return { kind: "stale" as const, currentVersion: current?.version ?? version };
      }
      const updated = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      return { kind: "updated" as const, ticket: updated, actions };
    });

    if (outcome.kind === "missing") return res.status(404).json({ message: "Ticket was not found" });
    if (outcome.kind === "stale") return res.status(409).json({ error: "This ticket was changed by another request; refresh and try again.", code: "STALE_VERSION", currentVersion: outcome.currentVersion });
    if (outcome.kind === "illegal") return res.status(409).json({ error: `Cannot transition from ${outcome.currentStatus} to ${targetStatus}.`, code: "ILLEGAL_TRANSITION" });
    if (outcome.kind === "gate") return res.status(409).json({ error: "The resolution conditions are not met.", code: "RESOLUTION_GATE", unmet: outcome.gate.unmet });
    return res.status(200).json({ ticket: {
      id: outcome.ticket.id,
      status: outcome.ticket.currentStatus,
      version: outcome.ticket.version,
      allowedTransitions: allowedTransitions(outcome.ticket.currentStatus),
      resolutionGate: resolutionGate(outcome.ticket.assignedStaffId, outcome.actions),
    } });
  } catch {
    return res.status(500).json({ message: "Unable to update ticket status" });
  }
});

// Issue #35 — communication is deliberately separate from workflow actions.
// Requesters may access only their own ticket; IT Staff can access the shared
// queue.  Internal notes never pass through a Requester response path.
const communicationLimit = 2000;

// Lab 4, Issue #58 — Actions Taken use a separate, append-only work log. A
// Requester may read current actions for their own ticket only; Staff and
// Administrators share the operational view. Writes are handled below and
// always derive the performer from the session rather than the request body.
const actionTextLimit = 2000;
const actionCreateStatuses = new Set<ActionStatus>([
  ActionStatus.PLANNED,
  ActionStatus.IN_PROGRESS,
  ActionStatus.COMPLETED,
]);
const actionStatuses = new Set<ActionStatus>(Object.values(ActionStatus));
const openActionStatuses = new Set<ActionStatus>([ActionStatus.PLANNED, ActionStatus.IN_PROGRESS]);
const finalActionStatuses = new Set<ActionStatus>([ActionStatus.COMPLETED, ActionStatus.CANCELLED]);

function actionResponse(action: {
  id: number; ticketId: number; performedById: number; assigneeId: number | null;
  status: ActionStatus; actionAt: Date; description: string; result: string;
  followUpRequired: boolean; followUpNote: string; attachmentNotes: string;
  version: number; createdAt: Date; updatedAt: Date;
  performedBy: { id: number; name: string }; assignee: { id: number; name: string } | null;
}) {
  return {
    id: action.id, ticketId: action.ticketId, performedBy: action.performedBy,
    assignee: action.assignee, status: action.status, actionAt: action.actionAt,
    description: action.description, result: action.result,
    followUpRequired: action.followUpRequired, followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes, version: action.version,
    createdAt: action.createdAt, updatedAt: action.updatedAt,
  };
}

function optionalActionText(value: unknown, field: string, errors: Record<string, string>) {
  if (value === undefined) return "";
  if (typeof value !== "string") { errors[field] = "Must be text."; return ""; }
  const text = value.trim();
  if (text.length > actionTextLimit) errors[field] = `Must not exceed ${actionTextLimit} characters.`;
  return text;
}

function actionCreateBody(body: unknown): { value?: {
  description: string; result: string; followUpRequired: boolean; followUpNote: string;
  attachmentNotes: string; actionAt: Date; status: ActionStatus; assigneeId: number | null;
}; errors: Record<string, string> } {
  const source = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const errors: Record<string, string> = {};
  const description = typeof source.description === "string" ? source.description.trim() : "";
  if (!description) errors.description = "Description is required.";
  else if (description.length > actionTextLimit) errors.description = `Must not exceed ${actionTextLimit} characters.`;
  const result = optionalActionText(source.result, "result", errors);
  const attachmentNotes = optionalActionText(source.attachmentNotes, "attachmentNotes", errors);
  const rawFollowUpRequired = source.followUpRequired;
  if (rawFollowUpRequired !== undefined && typeof rawFollowUpRequired !== "boolean") errors.followUpRequired = "Must be true or false.";
  const followUpRequired = rawFollowUpRequired === true;
  const followUpNote = optionalActionText(source.followUpNote, "followUpNote", errors);
  if (followUpRequired === true && !followUpNote) errors.followUpNote = "A follow-up note is required when follow-up is required.";
  const status = source.status === undefined ? ActionStatus.PLANNED : source.status;
  if (!actionCreateStatuses.has(status as ActionStatus)) errors.status = "Create accepts PLANNED, IN_PROGRESS, or COMPLETED.";
  if (status === ActionStatus.COMPLETED && !result) errors.result = "A result is required for a completed action.";
  const actionAt = source.actionAt === undefined ? new Date() : typeof source.actionAt === "string" ? new Date(source.actionAt) : new Date("");
  if (Number.isNaN(actionAt.getTime())) errors.actionAt = "Must be a valid ISO date-time.";
  else if (actionAt.getTime() > Date.now() + 5 * 60_000) errors.actionAt = "Cannot be more than five minutes in the future.";
  const assigneeId = source.assigneeId === undefined || source.assigneeId === null ? null : source.assigneeId;
  if (assigneeId !== null && !positiveInteger(assigneeId)) errors.assigneeId = "Must be an active IT Staff or Administrator id, or null.";
  if (Object.keys(errors).length) return { errors };
  return { value: { description, result, followUpRequired, followUpNote, attachmentNotes, actionAt, status: status as ActionStatus, assigneeId: assigneeId as number | null }, errors };
}

type EditableAction = {
  status: ActionStatus; assigneeId: number | null; actionAt: Date; description: string;
  result: string; followUpRequired: boolean; followUpNote: string; attachmentNotes: string;
};

// Patch validation starts with the stored values. This makes omitted fields stay
// unchanged while still applying the cross-field rules to the resulting action.
function actionEditBody(body: unknown, stored: EditableAction): { value?: EditableAction; errors: Record<string, string> } {
  const source = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const errors: Record<string, string> = {};
  const value: EditableAction = {
    status: stored.status, assigneeId: stored.assigneeId, actionAt: stored.actionAt,
    description: stored.description, result: stored.result,
    followUpRequired: stored.followUpRequired, followUpNote: stored.followUpNote,
    attachmentNotes: stored.attachmentNotes,
  };

  const text = (field: "description" | "result" | "followUpNote" | "attachmentNotes", required: boolean) => {
    if (source[field] === undefined) return;
    if (typeof source[field] !== "string") { errors[field] = "Must be text."; return; }
    const trimmed = source[field].trim();
    if (required && !trimmed) errors[field] = "Description is required.";
    else if (trimmed.length > actionTextLimit) errors[field] = `Must not exceed ${actionTextLimit} characters.`;
    else value[field] = trimmed;
  };
  text("description", true);
  text("result", false);
  text("followUpNote", false);
  text("attachmentNotes", false);

  if (source.followUpRequired !== undefined) {
    if (typeof source.followUpRequired !== "boolean") errors.followUpRequired = "Must be true or false.";
    else value.followUpRequired = source.followUpRequired;
  }
  if (source.status !== undefined) {
    if (!actionStatuses.has(source.status as ActionStatus)) errors.status = "Must be PLANNED, IN_PROGRESS, COMPLETED, or CANCELLED.";
    else value.status = source.status as ActionStatus;
  }
  if (source.assigneeId !== undefined) {
    if (source.assigneeId !== null && !positiveInteger(source.assigneeId)) errors.assigneeId = "Must be an active IT Staff or Administrator id, or null.";
    else value.assigneeId = source.assigneeId as number | null;
  }
  if (source.actionAt !== undefined) {
    const actionAt = typeof source.actionAt === "string" ? new Date(source.actionAt) : new Date("");
    if (Number.isNaN(actionAt.getTime())) errors.actionAt = "Must be a valid ISO date-time.";
    else if (actionAt.getTime() > Date.now() + 5 * 60_000) errors.actionAt = "Cannot be more than five minutes in the future.";
    else value.actionAt = actionAt;
  }
  if (value.followUpRequired && !value.followUpNote) errors.followUpNote = "A follow-up note is required when follow-up is required.";
  if (!value.followUpRequired) value.followUpNote = "";
  if (value.status === ActionStatus.COMPLETED && !value.result) errors.result = "A result is required for a completed action.";
  return Object.keys(errors).length ? { errors } : { value, errors };
}

function actionEditMoveAllowed(from: ActionStatus, to: ActionStatus) {
  if (from === to) return true;
  if (from === ActionStatus.PLANNED) return to === ActionStatus.IN_PROGRESS || to === ActionStatus.COMPLETED || to === ActionStatus.CANCELLED;
  if (from === ActionStatus.IN_PROGRESS) return to === ActionStatus.COMPLETED || to === ActionStatus.CANCELLED;
  return false;
}

async function eligibleActionAssignee(assigneeId: number | null) {
  if (assigneeId === null) return true;
  const assignee = await getPrisma().user.findUnique({ where: { id: assigneeId }, select: { role: true, isActive: true } });
  return !!assignee && assignee.isActive && ["IT_STAFF", "ADMINISTRATOR"].includes(assignee.role);
}

async function requesterOwnsTicket(req: AuthenticatedRequest, ticketId: number) {
  const requesterId = await authenticatedRequesterId(req);
  return !!requesterId && !!(await getPrisma().ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } }));
}

app.get("/api/tickets/:ticketId/actions", requireAuth, requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });
  const role = req.auth!.user.role;
  if (role !== "REQUESTER" && role !== "IT_STAFF" && role !== "ADMINISTRATOR") return authError(res, 403, "FORBIDDEN", "You do not have permission to view actions.");
  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) return res.status(404).json({ message: "Ticket was not found" });
    if (role === "REQUESTER" && !(await requesterOwnsTicket(req, ticketId))) return res.status(404).json({ message: "Ticket was not found" });
    const actions = await prisma.actionTaken.findMany({
      where: { ticketId },
      include: { performedBy: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } } },
      orderBy: [{ actionAt: "asc" }, { id: "asc" }],
    });
    return res.status(200).json({ actions: actions.map(actionResponse) });
  } catch { return res.status(500).json({ message: "Unable to load actions." }); }
});

app.post("/api/tickets/:ticketId/actions", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, requireSameOrigin, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });
  const parsed = actionCreateBody(req.body);
  if (!parsed.value) return res.status(400).json({ error: "Validation failed.", errors: parsed.errors });
  try {
    const prisma = getPrisma();
    if (!(await eligibleActionAssignee(parsed.value.assigneeId))) {
        return res.status(400).json({ error: "Validation failed.", errors: { assigneeId: "Must identify an active IT Staff or Administrator." } });
    }
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number; currentStatus: string }>>(Prisma.sql`SELECT "id", "currentStatus" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`);
      const ticket = locked[0];
      if (!ticket) return { kind: "missing" as const };
      if (ticket.currentStatus === "Closed" || ticket.currentStatus === "Cancelled") return { kind: "closed" as const };
      if (ticket.currentStatus === "Resolved" && parsed.value!.status !== ActionStatus.COMPLETED) return { kind: "resolved" as const };
      const action = await tx.actionTaken.create({
        data: { ticketId, performedById: req.auth!.user.id, ...parsed.value! },
        include: { performedBy: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } } },
      });
      await tx.actionTakenRevision.create({
        data: {
          actionTakenId: action.id, revision: 1, editedById: req.auth!.user.id, editedAt: action.createdAt,
          status: action.status, assigneeId: action.assigneeId, actionAt: action.actionAt,
          description: action.description, result: action.result, followUpRequired: action.followUpRequired,
          followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes,
        },
      });
      return { kind: "created" as const, action };
    });
    if (result.kind === "missing") return res.status(404).json({ message: "Ticket was not found" });
    if (result.kind === "closed") return res.status(409).json({ error: "Actions cannot be changed on a closed or cancelled ticket.", code: "TICKET_CLOSED" });
    if (result.kind === "resolved") return res.status(409).json({ error: "Reopen the ticket before adding open work.", code: "TICKET_RESOLVED" });
    return res.status(201).json(actionResponse(result.action));
  } catch { return res.status(500).json({ message: "Unable to create action." }); }
});

// Issue #59 — Action Taken edits are optimistic (versioned), append a
// revision atomically, and never modify a final action.
app.patch("/api/tickets/:ticketId/actions/:actionId", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, requireSameOrigin, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const actionId = Number(req.params.actionId);
  if (!positiveInteger(ticketId) || !positiveInteger(actionId)) return res.status(400).json({ error: "Validation failed.", errors: { id: "A valid ticket and action id are required." } });
  const source = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  if (!positiveInteger(source.version)) return res.status(400).json({ error: "Validation failed.", errors: { version: "A current integer version is required." } });

  try {
    const prisma = getPrisma();
    const outcome = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number; currentStatus: string }>>(Prisma.sql`SELECT "id", "currentStatus" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`);
      const ticket = locked[0];
      if (!ticket) return { kind: "ticketMissing" as const };
      const stored = await tx.actionTaken.findFirst({ where: { id: actionId, ticketId } });
      if (!stored) return { kind: "actionMissing" as const };
      if (ticket.currentStatus === "Closed" || ticket.currentStatus === "Cancelled") return { kind: "closed" as const };
      if (finalActionStatuses.has(stored.status)) return { kind: "final" as const };
      if (stored.version !== source.version) return { kind: "stale" as const, currentVersion: stored.version };

      const parsed = actionEditBody(source, stored);
      if (!parsed.value) return { kind: "invalid" as const, errors: parsed.errors };
      if (!actionEditMoveAllowed(stored.status, parsed.value.status)) return { kind: "invalid" as const, errors: { status: `Cannot move an action from ${stored.status} to ${parsed.value.status}.` } };
      if (ticket.currentStatus === "Resolved" && openActionStatuses.has(parsed.value.status)) return { kind: "resolved" as const };
      // An existing action may legitimately remain assigned to a former staff
      // member. Only validate assignee eligibility when this PATCH actually
      // changes (or explicitly re-sends) assigneeId.
      if (source.assigneeId !== undefined && !(await eligibleActionAssignee(parsed.value.assigneeId))) {
        return { kind: "invalid" as const, errors: { assigneeId: "Must identify an active IT Staff or Administrator." } };
      }

      const update = await tx.actionTaken.updateMany({
        where: { id: actionId, ticketId, version: stored.version },
        data: { ...parsed.value, version: { increment: 1 } },
      });
      if (update.count !== 1) return { kind: "stale" as const, currentVersion: stored.version };
      await tx.actionTakenRevision.create({ data: { actionTakenId: actionId, revision: stored.version + 1, editedById: req.auth!.user.id, ...parsed.value } });
      const action = await tx.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
        include: { performedBy: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } } },
      });
      return { kind: "updated" as const, action };
    });
    if (outcome.kind === "ticketMissing") return res.status(404).json({ message: "Ticket was not found" });
    if (outcome.kind === "actionMissing") return res.status(404).json({ message: "Action was not found" });
    if (outcome.kind === "closed") return res.status(409).json({ error: "Actions cannot be changed on a closed or cancelled ticket.", code: "TICKET_CLOSED" });
    if (outcome.kind === "final") return res.status(409).json({ error: "Completed or cancelled actions cannot be edited.", code: "ACTION_FINAL" });
    if (outcome.kind === "stale") return res.status(409).json({ error: "This action was changed by another request; refresh and try again.", code: "STALE_VERSION", currentVersion: outcome.currentVersion });
    if (outcome.kind === "resolved") return res.status(409).json({ error: "Reopen the ticket before adding open work.", code: "TICKET_RESOLVED" });
    if (outcome.kind === "invalid") return res.status(400).json({ error: "Validation failed.", errors: outcome.errors });
    return res.status(200).json(actionResponse(outcome.action));
  } catch { return res.status(500).json({ message: "Unable to update action." }); }
});

app.get("/api/tickets/:ticketId/actions/:actionId/revisions", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const actionId = Number(req.params.actionId);
  if (!positiveInteger(ticketId) || !positiveInteger(actionId)) return res.status(400).json({ message: "A valid ticket and action id are required" });
  try {
    const prisma = getPrisma();
    const action = await prisma.actionTaken.findFirst({ where: { id: actionId, ticketId }, select: { id: true } });
    if (!action) return res.status(404).json({ message: "Action was not found" });
    const revisions = await prisma.actionTakenRevision.findMany({
      where: { actionTakenId: actionId }, include: { editedBy: { select: { id: true, name: true } } }, orderBy: { revision: "asc" },
    });
    return res.status(200).json({ revisions: revisions.map((revision) => ({
      revision: revision.revision, editedBy: revision.editedBy, editedAt: revision.editedAt,
      status: revision.status, assigneeId: revision.assigneeId, actionAt: revision.actionAt,
      description: revision.description, result: revision.result, followUpRequired: revision.followUpRequired,
      followUpNote: revision.followUpNote, attachmentNotes: revision.attachmentNotes,
    })) });
  } catch { return res.status(500).json({ message: "Unable to load action history." }); }
});

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
    if (!(await canAccessTicketCommunication(req, ticketId, true))) return authError(res, req.auth!.user.role === "REQUESTER" ? 404 : 403, "FORBIDDEN", "You do not have permission to post this comment.");
    const comment = await prisma.ticketComment.create({ data: { ticketId, authorId: req.auth!.user.id, body: content }, include: { author: { select: { id: true, name: true } } } });
    return res.status(201).json(communicationResponse(comment));
  } catch { return res.status(500).json({ message: "Unable to post comment" }); }
});

app.get("/api/tickets/:ticketId/notes", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!positiveInteger(ticketId)) return res.status(400).json({ message: "A valid ticket id is required" });
  try { const prisma = getPrisma(); const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } }); if (!ticket) return res.status(404).json({ message: "Ticket was not found" }); const notes = await prisma.internalNote.findMany({ where: { ticketId }, include: { author: { select: { id: true, name: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }); return res.status(200).json(notes.map(communicationResponse)); } catch { return res.status(500).json({ message: "Unable to load notes" }); }
});

app.post("/api/tickets/:ticketId/notes", requireSameOrigin, requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
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
      version: ticket.version,
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

app.get("/api/attachments/:attachmentId/download", requireAuth, requireRole("REQUESTER", "IT_STAFF", "ADMINISTRATOR"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  // Requesters remain scoped to their own tickets. IT Staff, who work from
  // the shared queue, may download an active attachment from any ticket.
  // Administrators have the same shared-ticket read access in Lab 4.
  const isRequester = req.auth!.user.role === "REQUESTER";
  const requesterId = isRequester ? await authenticatedRequesterId(req) : undefined;
  const attachmentId = Number(req.params.attachmentId);

  if (isRequester && !requesterId) {
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

    if (isRequester && attachment.ticket.requesterId !== requesterId) {
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

// Issue #37 — Administrator user management.  These routes intentionally use
// the server-side session for authority and never expose hashes or sessions.
const userFields = { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true, updatedAt: true } as const;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function adminValidation(res: Response, message: string) { return authError(res, 400, "VALIDATION_ERROR", message); }
function cleanName(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function cleanEmail(value: unknown) { return typeof value === "string" ? value.trim().toLowerCase() : ""; }
function validPassword(value: unknown) { return typeof value === "string" && value.length >= 8 && value.length <= 128; }

app.get("/api/admin/users", requireAuth, requireRole("ADMINISTRATOR"), requirePasswordUpToDate, async (req: AuthenticatedRequest, res: Response) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const role = req.query.role;
  if (role !== undefined && !validRole(role)) return adminValidation(res, "A valid role is required.");
  try {
    const where = { ...(role ? { role } : {}), ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] } : {}) };
    return res.status(200).json(await getPrisma().user.findMany({ where, select: userFields, orderBy: [{ name: "asc" }, { id: "asc" }] }));
  } catch { return authError(res, 500, "USER_LIST_ERROR", "Unable to load users."); }
});

app.post("/api/admin/users", requireSameOrigin, requireAuth, requireRole("ADMINISTRATOR"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const { role, isActive, initialPassword } = req.body ?? {}; const name = cleanName(req.body?.name); const email = cleanEmail(req.body?.email);
  if (!name || name.length > 120 || !emailPattern.test(email) || !validRole(role) || typeof isActive !== "boolean" || !validPassword(initialPassword)) return adminValidation(res, "Name, email, one valid role, active status, and an 8–128 character initial password are required.");
  try {
    const passwordHash = await hashPassword(initialPassword);
    const user = await getPrisma().$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name, email, role, isActive, passwordHash, mustChangePassword: true }, select: userFields });
      if (role === "REQUESTER") await tx.requester.create({ data: { userId: created.id, name, email, isActive } });
      return created;
    });
    return res.status(201).json(user);
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return authError(res, 409, "EMAIL_CONFLICT", "That email address is already in use."); return authError(res, 500, "USER_CREATE_ERROR", "Unable to create user."); }
});

app.patch("/api/admin/users/:userId", requireSameOrigin, requireAuth, requireRole("ADMINISTRATOR"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const userId = Number(req.params.userId); const body = req.body ?? {};
  if (!positiveInteger(userId) || !["name", "email", "role", "isActive"].some((key) => Object.prototype.hasOwnProperty.call(body, key))) return adminValidation(res, "Provide a valid user and at least one editable field.");
  const data: { name?: string; email?: string; role?: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; isActive?: boolean } = {};
  if ("name" in body) { const name = cleanName(body.name); if (!name || name.length > 120) return adminValidation(res, "Name must be 1 to 120 characters."); data.name = name; }
  if ("email" in body) { const email = cleanEmail(body.email); if (!emailPattern.test(email)) return adminValidation(res, "A valid email is required."); data.email = email; }
  if ("role" in body) { if (!validRole(body.role)) return adminValidation(res, "A valid role is required."); data.role = body.role; }
  if ("isActive" in body) { if (typeof body.isActive !== "boolean") return adminValidation(res, "Active status must be true or false."); data.isActive = body.isActive; }
  if (data.isActive === false && userId === req.auth!.user.id) return authError(res, 409, "SELF_DEACTIVATION", "You cannot deactivate your own account.");
  try {
    const prisma = getPrisma(); const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return authError(res, 404, "USER_NOT_FOUND", "User was not found.");
    const removesLastAdmin = target.role === "ADMINISTRATOR" && target.isActive && (data.isActive === false || (data.role !== undefined && data.role !== "ADMINISTRATOR"));
    if (removesLastAdmin && await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } }) <= 1) return authError(res, 409, "LAST_ADMINISTRATOR", "At least one active Administrator is required.");
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: userId }, data, select: userFields });
      // Keep a Requester profile aligned whenever the account remains a Requester.
      if (updated.role === "REQUESTER") await tx.requester.upsert({ where: { userId }, update: { name: updated.name, email: updated.email, isActive: updated.isActive }, create: { userId, name: updated.name, email: updated.email, isActive: updated.isActive } });
      return updated;
    });
    return res.status(200).json(user);
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return authError(res, 409, "EMAIL_CONFLICT", "That email address is already in use."); return authError(res, 500, "USER_UPDATE_ERROR", "Unable to update user."); }
});

app.post("/api/admin/users/:userId/initial-password", requireSameOrigin, requireAuth, requireRole("ADMINISTRATOR"), requirePasswordUpToDate, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const userId = Number(req.params.userId); const initialPassword = req.body?.initialPassword;
  if (!positiveInteger(userId) || !validPassword(initialPassword)) return adminValidation(res, "A valid user and an 8–128 character initial password are required.");
  try { const user = await getPrisma().user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(initialPassword), mustChangePassword: true }, select: userFields }); return res.status(200).json(user); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return authError(res, 404, "USER_NOT_FOUND", "User was not found."); return authError(res, 500, "PASSWORD_RESET_ERROR", "Unable to reset password."); }
});

export default app;

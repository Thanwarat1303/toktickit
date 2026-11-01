import type { AuthUser, Priority, TicketStatus } from "./api.js";

export type View = "dashboard" | "newTicket" | "myTickets" | "queue" | "users";

export interface QueueFilters {
  ownerId?: "me" | "unassigned";
  open?: boolean;
  recent?: boolean;
  actionAssigneeId?: "me";
  status?: TicketStatus;
  itPriority?: "Low" | "Medium" | "High" | "Urgent";
  sortBy?: "updatedAt";
}

export interface MyTicketFilters {
  open?: boolean;
  recent?: boolean;
  status?: TicketStatus;
  sortBy?: "updatedAt";
}

export type Route =
  | { view: "dashboard" | "newTicket" | "users" }
  | { view: "queue"; filters: QueueFilters; ticketId?: number; section?: "actions-taken" }
  | { view: "myTickets"; filters: MyTicketFilters; ticketId?: number };

const STATUSES: readonly TicketStatus[] = ["New", "Open", "In Progress", "Waiting for Requester", "Resolved", "Closed", "Reopened", "Cancelled"];
const PRIORITIES: readonly string[] = ["Low", "Medium", "High", "Urgent"];

export function allowedViews(role: AuthUser["role"]): View[] {
  if (role === "REQUESTER") return ["dashboard", "newTicket", "myTickets"];
  if (role === "IT_STAFF") return ["dashboard", "queue"];
  return ["dashboard", "queue", "users"];
}

function positiveId(raw: string | undefined): number | undefined {
  return raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : undefined;
}

function sharedFilters(params: URLSearchParams): MyTicketFilters {
  const filters: MyTicketFilters = {};
  if (params.get("open") === "1") filters.open = true;
  if (params.get("recent") === "1") filters.recent = true;
  const status = params.get("status");
  if (status && STATUSES.includes(status as TicketStatus)) filters.status = status as TicketStatus;
  if (params.get("sortBy") === "updatedAt") filters.sortBy = "updatedAt";
  return filters;
}

export function parseRoute(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const [, page, rawId] = path.split("/");
  if (page === "new-ticket") return { view: "newTicket" };
  if (page === "users") return { view: "users" };
  if (page === "my-tickets") {
    const route: Route = { view: "myTickets", filters: sharedFilters(params) };
    const ticketId = positiveId(rawId);
    if (ticketId !== undefined) route.ticketId = ticketId;
    return route;
  }
  if (page === "queue") {
    const filters = sharedFilters(params) as QueueFilters;
    const owner = params.get("ownerId");
    if (owner === "me" || owner === "unassigned") filters.ownerId = owner;
    if (params.get("actionAssigneeId") === "me") filters.actionAssigneeId = "me";
    const priority = params.get("itPriority");
    if (priority && PRIORITIES.includes(priority)) filters.itPriority = priority as QueueFilters["itPriority"];
    const route: Route = { view: "queue", filters };
    const ticketId = positiveId(rawId);
    if (ticketId !== undefined) {
      route.ticketId = ticketId;
      if (params.get("section") === "actions-taken") route.section = "actions-taken";
    }
    return route;
  }
  return { view: "dashboard" };
}

export function routeHref(route: Route): string {
  if (route.view === "dashboard") return "#/dashboard";
  if (route.view === "newTicket") return "#/new-ticket";
  if (route.view === "users") return "#/users";
  if (route.view !== "queue" && route.view !== "myTickets") return "#/dashboard";
  const params = new URLSearchParams();
  const filters = route.filters;
  if (route.view === "queue") {
    if (route.filters.ownerId) params.set("ownerId", route.filters.ownerId);
    if (route.filters.actionAssigneeId) params.set("actionAssigneeId", route.filters.actionAssigneeId);
    if (route.filters.itPriority) params.set("itPriority", route.filters.itPriority);
    if (filters.status) params.set("status", filters.status);
    if (filters.open) params.set("open", "1");
    if (filters.recent) params.set("recent", "1");
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (route.ticketId !== undefined && route.section) params.set("section", route.section);
  } else {
    if (filters.status) params.set("status", filters.status);
    if (filters.open) params.set("open", "1");
    if (filters.recent) params.set("recent", "1");
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
  }
  const query = params.toString();
  const base = `${route.view === "queue" ? "#/queue" : "#/my-tickets"}${route.ticketId !== undefined ? `/${route.ticketId}` : ""}`;
  return `${base}${query ? `?${query}` : ""}`;
}

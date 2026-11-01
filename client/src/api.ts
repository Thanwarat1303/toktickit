const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
export interface AuthUser { id: number; name: string; email: string; role: UserRole; isActive: boolean; mustChangePassword: boolean; }
export interface AuthSession { user: AuthUser; csrfToken: string; }

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus = "New" | "Open" | "In Progress" | "Waiting for Requester" | "Resolved" | "Closed" | "Reopened" | "Cancelled";

export interface RelatedSystem {
  id: number;
  name: string;
}

// Ticket detail still exposes the legacy Requester profile as display data.
// It is never used by the client to select ownership or authorize a request.
export interface Requester {
  id: number;
  name: string;
  email: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface CreateTicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  priority: "Low" | "Medium" | "High";
}

export interface CreatedTicket {
  id: number;
  ticketNumber: string;
  status: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  priority: "Low" | "Medium" | "High";
  createdAt: string;
}

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  priority: "Low" | "Medium" | "High";
  status: string;
  category: Category;
  relatedSystem: RelatedSystem;
  createdAt: string;
}

export interface TicketDetail {
  id: number;
  version: number;
  ticketNumber: string;
  requester: Requester;
  category: Category;
  relatedSystem: RelatedSystem;
  summary: string;
  description: string;
  priority: "Low" | "Medium" | "High";
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentSummary {
  id: number;
  ticketId: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  removedAt: string | null;
  removalReason: string | null;
}
export interface TicketCommunication { id: number; ticketId: number; author: { id: number; name: string }; content: string; createdAt: string; }

export interface TicketListResponse {
  items: TicketListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TicketListQuery {
  search?: string;
  status?: string;
  categoryId?: number;
  relatedSystemId?: number;
  priority?: "Low" | "Medium" | "High";
  sortBy?: "createdAt" | "updatedAt" | "summary" | "priority";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  open?: boolean;
  recent?: boolean;
}

export interface StaffTicketSummary {
  id: number;
  ticketNumber: string;
  summary: string;
  priority: "Low" | "Medium" | "High";
  itPriority: "Low" | "Medium" | "High" | "Urgent";
  status: string;
  category: Category;
  relatedSystem: RelatedSystem;
  requesterName: string;
  owner: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffTicketQueueResponse {
  tickets: StaffTicketSummary[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface StaffTicketQueueQuery {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  itPriority?: "Low" | "Medium" | "High" | "Urgent";
  status?: string;
  ownerId?: number | "me" | "unassigned";
  sortBy?: "createdAt" | "updatedAt" | "itPriority" | "status";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  open?: boolean;
  recent?: boolean;
  actionAssigneeId?: "me";
}

function serializeQueryValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true) return "1";
  if (value === false) return undefined;
  return String(value);
}

export interface TicketBrief {
  id: number;
  ticketNumber: string;
  summary: string;
  currentStatus: TicketStatus;
  itPriority: Priority;
  updatedAt: string;
}

export interface RequesterDashboardData {
  generatedAt: string;
  timezone: string;
  openTickets: number;
  waitingForRequester: number;
  recentlyUpdated: TicketBrief[];
  recentlyResolved: TicketBrief[];
}

export interface ActionBrief {
  id: number;
  ticketId: number;
  ticketNumber: string;
  status: string;
  actionAt: string;
  description: string;
}

export interface StaffDashboardData {
  generatedAt: string;
  timezone: string;
  unassigned: number;
  assignedToMe: number;
  ticketsWithMyOpenActions: number;
  myRecentActions: ActionBrief[];
  byStatus: Record<string, number>;
  byItPriority: Record<string, number>;
  recentlyUpdated: TicketBrief[];
  userCounts?: { total: number; active: number; inactive: number; byRole: Record<string, number> };
}

export interface StaffTicketDetail extends Omit<StaffTicketSummary, "requesterName" | "owner"> {
  version: number;
  allowedTransitions: WorkflowStatus[];
  resolutionGate: { ok: boolean; unmet: string[] };
  requester: Requester;
  owner: { id: number; name: string; email: string } | null;
  attachments: AttachmentSummary[];
  publicComments: TicketCommunication[];
  internalNotes: TicketCommunication[];
  description: string;
}

export interface AssignableStaffUser {
  id: number;
  name: string;
  email: string;
}

export type WorkflowStatus =
  | "New"
  | "Open"
  | "In Progress"
  | "Waiting for Requester"
  | "Resolved"
  | "Closed"
  | "Reopened"
  | "Cancelled";

export class ApiRequestError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new ApiRequestError(body?.error?.message ?? "Unable to complete the request.");
  }
  return response.json() as Promise<T>;
}

export function login(email: string, password: string) {
  return authRequest<AuthSession>("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
}

export function getCurrentUser() {
  return authRequest<AuthSession>("/api/auth/me");
}

export function changePassword(currentCsrfToken: string, currentPassword: string, newPassword: string, confirmPassword: string) {
  return authRequest<AuthSession>("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": currentCsrfToken }, body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) });
}

export async function logout(csrfToken: string) {
  const response = await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include", headers: { "X-CSRF-Token": csrfToken } });
  if (!response.ok) throw new ApiRequestError("Unable to sign out.");
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const data: { message?: unknown; error?: unknown } = await response.json();
    if (typeof data.message === "string") return data.message;
    if (typeof data.error === "string") return data.error;
    return fallback;
  } catch {
    return fallback;
  }
}

export async function checkHealth(): Promise<void> {
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error("Unable to connect to TokTickIT API");
  }

  const data = await response.json();

  if (data.status !== "ok") {
    throw new Error("TokTickIT API is unavailable");
  }
}

export async function checkSystem(): Promise<SystemStatus> {
  await checkHealth();

  const response = await fetch(`${API_URL}/api/categories`, { credentials: "include" });

  if (!response.ok) {
    throw new Error("Unable to load request categories");
  }

  const categories: Category[] = await response.json();

  return {
    online: true,
    categories,
  };
}

export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await fetch(`${API_URL}/api/related-systems`, { credentials: "include" });

  if (!response.ok) {
    throw new ApiRequestError(
      await getErrorMessage(response, "Unable to load related systems")
    );
  }

  return response.json();
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/api/categories`, { credentials: "include" });

  if (!response.ok) {
    throw new ApiRequestError(
      await getErrorMessage(response, "Unable to load request categories")
    );
  }

  return response.json();
}

export async function getTickets(query: TicketListQuery): Promise<TicketListResponse> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    const serialized = serializeQueryValue(value);
    if (serialized !== undefined) params.set(key, serialized);
  }

  const response = await fetch(`${API_URL}/api/tickets?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiRequestError(await getErrorMessage(response, "Unable to load tickets"), response.status);
  }

  return response.json();
}

export async function getTicketDetail(ticketId: number): Promise<TicketDetail> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiRequestError(await getErrorMessage(response, "Unable to load ticket details"));
  }

  return response.json();
}

export async function getTicketAttachments(ticketId: number): Promise<AttachmentSummary[]> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiRequestError(await getErrorMessage(response, "Unable to load attachments"));
  }

  return response.json();
}

export async function getTicketComments(ticketId: number): Promise<TicketCommunication[]> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, { credentials: "include" });
  if (!response.ok) throw new ApiRequestError(await getErrorMessage(response, "Unable to load comments"));
  return response.json();
}

export async function postTicketComment(ticketId: number, content: string, csrfToken: string): Promise<TicketCommunication> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify({ content }) });
  if (!response.ok) throw new ApiRequestError(await getErrorMessage(response, "Unable to post comment"));
  return response.json();
}

export async function uploadTicketAttachment(
  ticketId: number,
  file: File,
  csrfToken: string,
): Promise<AttachmentSummary> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    credentials: "include",
    headers: {
      "X-CSRF-Token": csrfToken,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new ApiRequestError(await getErrorMessage(response, "Unable to upload attachment"));
  }

  return response.json();
}

export function attachmentDownloadUrl(attachmentId: number): string {
  return `${API_URL}/api/attachments/${attachmentId}/download`;
}

export async function removeAttachment(
  attachmentId: number,
  removalReason: string,
  csrfToken: string,
): Promise<AttachmentSummary> {
  const response = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ removalReason }),
  });

  if (!response.ok) {
    throw new ApiRequestError(await getErrorMessage(response, "Unable to remove attachment"));
  }

  return response.json();
}

export async function createTicket(
  input: CreateTicketInput,
  csrfToken: string,
): Promise<CreatedTicket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({
      categoryId: input.categoryId,
      relatedSystemId: input.relatedSystemId,
      summary: input.summary,
      description: input.description,
      priority: input.priority,
    }),
  });

  if (!response.ok) {
    throw new ApiRequestError(
      await getErrorMessage(response, "Unable to create the ticket")
    );
  }

  return response.json();
}

export async function getStaffTickets(query: StaffTicketQueueQuery): Promise<StaffTicketQueueResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const serialized = serializeQueryValue(value);
    if (serialized !== undefined) params.set(key, serialized);
  }
  const response = await fetch(`${API_URL}/api/staff/tickets?${params.toString()}`, { credentials: "include" });
  if (!response.ok) throw new ApiRequestError(await getErrorMessage(response, "Unable to load the ticket queue"), response.status);
  return response.json();
}

export async function fetchRequesterDashboard(): Promise<RequesterDashboardData> {
  const response = await fetch(`${API_URL}/api/dashboard/requester`, { credentials: "include" });
  if (!response.ok) throw new ApiRequestError(await getErrorMessage(response, "Unable to load the dashboard"), response.status);
  return response.json();
}

export async function fetchStaffDashboard(): Promise<StaffDashboardData> {
  const response = await fetch(`${API_URL}/api/dashboard/staff`, { credentials: "include" });
  if (!response.ok) throw new ApiRequestError(await getErrorMessage(response, "Unable to load the dashboard"), response.status);
  return response.json();
}

export async function getStaffTicketDetail(ticketId: number): Promise<StaffTicketDetail> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}`, { credentials: "include" });
  if (!response.ok) throw new ApiRequestError(await getErrorMessage(response, "Unable to load staff ticket details"));
  return response.json();
}

async function staffMutation<T>(path: string, method: "POST" | "PATCH", csrfToken: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new ApiRequestError(await getErrorMessage(response, "Unable to update ticket"));
  return response.json() as Promise<T>;
}

export function claimStaffTicket(ticketId: number, version: number, csrfToken: string) {
  return staffMutation<{ id: number; owner: { id: number; name: string } | null; version: number; updatedAt: string }>(`/api/staff/tickets/${ticketId}/claim`, "POST", csrfToken, { version });
}

export function updateStaffTicketOwner(ticketId: number, ownerId: number | null, version: number, csrfToken: string) {
  return staffMutation<{ id: number; owner: { id: number; name: string } | null; version: number; updatedAt: string }>(`/api/staff/tickets/${ticketId}/owner`, "PATCH", csrfToken, { ownerId, version });
}

export function updateStaffTicketWorkflow(ticketId: number, input: { itPriority: StaffTicketSummary["itPriority"]; version: number }, csrfToken: string) {
  return staffMutation<{ id: number; itPriority: StaffTicketSummary["itPriority"]; status: WorkflowStatus; version: number; updatedAt: string }>(`/api/staff/tickets/${ticketId}/workflow`, "PATCH", csrfToken, input);
}

export function updateStaffTicketStatus(ticketId: number, input: { currentStatus: WorkflowStatus; confirm?: true; version: number }, csrfToken: string) {
  return staffMutation<{ ticket: { id: number; status: WorkflowStatus; version: number; allowedTransitions: WorkflowStatus[]; resolutionGate: { ok: boolean; unmet: string[] } } }>(`/api/staff/tickets/${ticketId}/status`, "PATCH", csrfToken, input);
}

export async function getAssignableStaffUsers(): Promise<AssignableStaffUser[]> {
  const response = await fetch(`${API_URL}/api/staff/assignable-users`, { credentials: "include" });
  if (!response.ok) throw new ApiRequestError(await getErrorMessage(response, "Unable to load assignable staff"));
  return response.json();
}

export function postInternalNote(ticketId: number, content: string, csrfToken: string) {
  return staffMutation<TicketCommunication>(`/api/tickets/${ticketId}/notes`, "POST", csrfToken, { content });
}

export interface ManagedUser extends AuthUser { createdAt: string; updatedAt: string; }
export interface CreateManagedUserInput { name: string; email: string; role: UserRole; isActive: boolean; initialPassword: string; }
export interface UpdateManagedUserInput { name?: string; email?: string; role?: UserRole; isActive?: boolean; }

async function adminRequest<T>(path: string, method: "GET" | "POST" | "PATCH", csrfToken?: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json", ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new ApiRequestError(await getErrorMessage(response, "Unable to update users"));
  return response.json() as Promise<T>;
}
export function getManagedUsers(query: { search?: string; role?: UserRole } = {}) { const p = new URLSearchParams(); if (query.search) p.set("search", query.search); if (query.role) p.set("role", query.role); return adminRequest<ManagedUser[]>(`/api/admin/users?${p}`, "GET"); }
export function createManagedUser(input: CreateManagedUserInput, csrfToken: string) { return adminRequest<ManagedUser>("/api/admin/users", "POST", csrfToken, input); }
export function updateManagedUser(id: number, input: UpdateManagedUserInput, csrfToken: string) { return adminRequest<ManagedUser>(`/api/admin/users/${id}`, "PATCH", csrfToken, input); }
export function resetManagedUserPassword(id: number, initialPassword: string, csrfToken: string) { return adminRequest<ManagedUser>(`/api/admin/users/${id}/initial-password`, "POST", csrfToken, { initialPassword }); }

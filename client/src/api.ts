const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
export interface AuthUser { id: number; name: string; email: string; role: UserRole; isActive: boolean; mustChangePassword: boolean; }
export interface AuthSession { user: AuthUser; csrfToken: string; }

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
  sortBy?: "createdAt" | "summary" | "priority";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
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
  ownerId?: number;
  sortBy?: "createdAt" | "updatedAt" | "itPriority" | "status";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export class ApiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiRequestError";
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
    const data: { message?: unknown } = await response.json();
    return typeof data.message === "string" ? data.message : fallback;
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
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const response = await fetch(`${API_URL}/api/tickets?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiRequestError(await getErrorMessage(response, "Unable to load tickets"));
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
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const response = await fetch(`${API_URL}/api/staff/tickets?${params.toString()}`, { credentials: "include" });
  if (!response.ok) throw new ApiRequestError(await getErrorMessage(response, "Unable to load the ticket queue"));
  return response.json();
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

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
  requesterId: number;
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

export class ApiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiRequestError";
  }
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

  const response = await fetch(`${API_URL}/api/categories`);

  if (!response.ok) {
    throw new Error("Unable to load request categories");
  }

  const categories: Category[] = await response.json();

  return {
    online: true,
    categories,
  };
}

export async function getRequesters(): Promise<Requester[]> {
  const response = await fetch(`${API_URL}/api/requesters`);

  if (!response.ok) {
    throw new Error("Unable to load development requesters");
  }

  return response.json();
}

export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await fetch(`${API_URL}/api/related-systems`);

  if (!response.ok) {
    throw new ApiRequestError(
      await getErrorMessage(response, "Unable to load related systems")
    );
  }

  return response.json();
}

export async function createTicket(
  input: CreateTicketInput
): Promise<CreatedTicket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requester-Id": String(input.requesterId),
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

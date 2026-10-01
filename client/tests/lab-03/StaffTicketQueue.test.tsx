import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StaffTicketQueue from "../../src/StaffTicketQueue.js";
import * as api from "../../src/api.js";

const response: api.StaffTicketQueueResponse = {
  tickets: [{
    id: 7,
    ticketNumber: "TK-000007",
    summary: "VPN disconnects every morning",
    priority: "High",
    itPriority: "Medium",
    status: "Open",
    category: { id: 1, name: "Network" },
    relatedSystem: { id: 2, name: "VPN" },
    requesterName: "Anan Student",
    owner: { id: 8, name: "IT Staff" },
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-02T10:00:00.000Z",
  }],
  pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
};

function mockQueue() {
  vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Network" }]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "VPN" }]);
  return vi.spyOn(api, "getStaffTickets").mockResolvedValue(response);
}

describe("Staff Ticket Queue", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the shared queue with the default sort and displays ticket data", async () => {
    const getStaffTickets = mockQueue();
    render(<StaffTicketQueue />);

    expect((await screen.findAllByText("VPN disconnects every morning")).length).toBe(2);
    expect(getStaffTickets).toHaveBeenCalledWith({ page: 1, pageSize: 20, sortBy: "createdAt", sortDir: "desc" });
    expect(screen.getByText("1 tickets")).toBeInTheDocument();
    expect(screen.getAllByText("IT Staff").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("option", { name: "Urgent" }).length).toBeGreaterThan(0);
  });

  it("sends a new queue query when staff search", async () => {
    const getStaffTickets = mockQueue();
    render(<StaffTicketQueue />);
    await screen.findAllByText("VPN disconnects every morning");

    fireEvent.change(screen.getByLabelText("Search tickets"), { target: { value: "VPN" } });

    await waitFor(() => expect(getStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ search: "VPN", page: 1 })));
  });

  it("shows an authorization message when the queue endpoint denies access", async () => {
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
    vi.spyOn(api, "getStaffTickets").mockRejectedValue(new api.ApiRequestError("You do not have permission to view this queue."));
    render(<StaffTicketQueue />);

    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to view this queue.");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MyTickets from "../../src/MyTickets.js";
import * as api from "../../src/api.js";

const requester: api.Requester = { id: 1, name: "Anan Student", email: "anan.student@toktickit.local" };

function mockTickets() {
  vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "Campus Wi-Fi" }]);
  vi.spyOn(api, "getTickets").mockResolvedValue({
    items: [{
      id: 1, ticketNumber: "TK-000001", summary: "Wi-Fi is unavailable", priority: "High", status: "New",
      category: { id: 1, name: "Hardware" }, relatedSystem: { id: 2, name: "Campus Wi-Fi" }, createdAt: "2026-09-01T10:00:00.000Z",
    }],
    page: 1, pageSize: 10, totalItems: 1, totalPages: 1,
  });
}

describe("My Tickets", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the active requester's ticket list", async () => {
    mockTickets();
    render(<MyTickets requester={requester} onOpenTicket={vi.fn()} />);

    expect(await screen.findByText("Wi-Fi is unavailable")).toBeInTheDocument();
    expect(api.getTickets).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 1, page: 1 }));
  });

  it("resets to page one when a filter changes", async () => {
    mockTickets();
    render(<MyTickets requester={requester} onOpenTicket={vi.fn()} />);

    await screen.findByText("Wi-Fi is unavailable");
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "High" } });

    expect(api.getTickets).toHaveBeenLastCalledWith(expect.objectContaining({ priority: "High", page: 1 }));
  });

  it("shows a helpful empty state", async () => {
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
    vi.spyOn(api, "getTickets").mockResolvedValue({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 1 });
    render(<MyTickets requester={requester} onOpenTicket={vi.fn()} />);

    expect(await screen.findByText("No tickets yet")).toBeInTheDocument();
  });

  it("opens the ticket detail view when the ticket number is clicked", async () => {
    const onOpenTicket = vi.fn();
    mockTickets();
    render(<MyTickets requester={requester} onOpenTicket={onOpenTicket} />);

    fireEvent.click(await screen.findByRole("button", { name: "TK-000001" }));

    expect(onOpenTicket).toHaveBeenCalledWith(1);
  });
});

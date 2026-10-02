import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import * as api from "../../src/api.js";

const detail: api.StaffTicketDetail = {
  id: 12, ticketNumber: "TK-000012", summary: "VPN is unavailable", description: "Cannot connect from the lab.",
  priority: "High", itPriority: "Medium", status: "In Progress", category: { id: 1, name: "Network" },
  relatedSystem: { id: 2, name: "VPN" }, requester: { id: 4, name: "Aom Student", email: "aom@test.local" },
  owner: null, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
  attachments: [], publicComments: [], internalNotes: [],
};

function mockDetail() {
  vi.spyOn(api, "getStaffTicketDetail").mockResolvedValue(detail);
  vi.spyOn(api, "getAssignableStaffUsers").mockResolvedValue([{ id: 9, name: "Nina Staff", email: "nina@test.local" }]);
}

describe("Staff Ticket Detail", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads ticket data and exposes distinct public and internal communication controls", async () => {
    mockDetail();
    render(<StaffTicketDetail ticketId={12} csrfToken="csrf" onBack={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "TK-000012" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Public comments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Internal notes/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Ticket owner")).toHaveValue("");
  });

  it("requires an explicit confirmation before a confirmation-required transition", async () => {
    mockDetail();
    const update = vi.spyOn(api, "updateStaffTicketWorkflow").mockResolvedValue({ id: 12, itPriority: "Medium", status: "Resolved", updatedAt: detail.updatedAt });
    render(<StaffTicketDetail ticketId={12} csrfToken="csrf" onBack={vi.fn()} />);
    await screen.findByRole("heading", { name: "TK-000012" });
    fireEvent.change(screen.getByLabelText("Change status"), { target: { value: "Resolved" } });
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(12, { status: "Resolved", confirm: true }, "csrf"));
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import * as api from "../../src/api.js";

const detail: api.StaffTicketDetail = {
  id: 12, version: 1, ticketNumber: "TK-000012", summary: "VPN is unavailable", description: "Cannot connect from the lab.",
  priority: "High", itPriority: "Medium", status: "In Progress", category: { id: 1, name: "Network" },
  relatedSystem: { id: 2, name: "VPN" }, requester: { id: 4, name: "Aom Student", email: "aom@test.local" },
  owner: null, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
  allowedTransitions: ["Waiting for Requester", "Resolved", "Cancelled"], resolutionGate: { ok: false, unmet: ["NO_COMPLETED_ACTION"] },
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
    const update = vi.spyOn(api, "updateStaffTicketStatus").mockResolvedValue({ ticket: { id: 12, status: "Resolved", version: 2, allowedTransitions: ["Closed", "Reopened"], resolutionGate: { ok: false, unmet: ["NO_COMPLETED_ACTION"] } } });
    render(<StaffTicketDetail ticketId={12} csrfToken="csrf" onBack={vi.fn()} />);
    await screen.findByRole("heading", { name: "TK-000012" });
    fireEvent.change(screen.getByLabelText("Change status"), { target: { value: "Resolved" } });
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(12, { currentStatus: "Resolved", version: 1, confirm: true }, "csrf"));
  });

  it("does not offer Unassigned while a resolved or closed ticket must retain its owner", async () => {
    const owner = { id: 9, name: "Nina Staff", email: "nina@test.local" };
    vi.spyOn(api, "getAssignableStaffUsers").mockResolvedValue([owner]);
    vi.spyOn(api, "getStaffTicketDetail").mockResolvedValue({ ...detail, status: "Resolved", owner, allowedTransitions: ["Closed", "Reopened"], resolutionGate: { ok: true, unmet: [] } });
    render(<StaffTicketDetail ticketId={12} csrfToken="csrf" onBack={vi.fn()} />);
    await screen.findByRole("heading", { name: "TK-000012" });
    const ownerSelect = screen.getByLabelText("Ticket owner");
    expect(ownerSelect).toHaveValue("9");
    expect(ownerSelect).not.toHaveTextContent("Unassigned");
    expect(screen.getByText(/Reopen this ticket before removing its owner/i)).toBeInTheDocument();
  });

  it("refreshes the ticket after a stale write so a later action uses the current version", async () => {
    const refreshed = { ...detail, version: 2, itPriority: "High" as const };
    const getDetail = vi.spyOn(api, "getStaffTicketDetail").mockResolvedValueOnce(detail).mockResolvedValue(refreshed);
    vi.spyOn(api, "getAssignableStaffUsers").mockResolvedValue([{ id: 9, name: "Nina Staff", email: "nina@test.local" }]);
    const update = vi.spyOn(api, "updateStaffTicketWorkflow")
      .mockRejectedValueOnce(new api.ApiRequestError("This ticket was changed by another request; refresh and try again."))
      .mockResolvedValueOnce({ id: 12, itPriority: "Urgent", status: "In Progress", version: 3, updatedAt: detail.updatedAt });

    render(<StaffTicketDetail ticketId={12} csrfToken="csrf" onBack={vi.fn()} />);
    await screen.findByRole("heading", { name: "TK-000012" });
    fireEvent.change(screen.getByLabelText("IT priority"), { target: { value: "High" } });
    fireEvent.click(screen.getByRole("button", { name: "Save IT priority" }));
    await waitFor(() => expect(getDetail).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText("IT priority"), { target: { value: "Urgent" } });
    fireEvent.click(screen.getByRole("button", { name: "Save IT priority" }));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith(12, { itPriority: "Urgent", version: 2 }, "csrf"));
  });
});

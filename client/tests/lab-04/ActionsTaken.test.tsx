import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ActionsTaken from "../../src/ActionsTaken.js";
import * as api from "../../src/api.js";

const action: api.ActionTaken = {
  id: 7, ticketId: 12, performedBy: { id: 2, name: "Staff" }, assignee: { id: 2, name: "Staff" },
  status: "PLANNED", actionAt: "2026-11-02T08:00:00.000Z", description: "Check network", result: "",
  followUpRequired: false, followUpNote: "", attachmentNotes: "", version: 1, createdAt: "2026-11-02T08:00:00.000Z", updatedAt: "2026-11-02T08:00:00.000Z",
};

describe("ActionsTaken", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows actions read-only to a Requester", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([action]);
    render(<ActionsTaken ticketId={12} ticketStatus="Open" readOnly />);
    expect(await screen.findByText("Check network")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("requires a result before saving a Completed action", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValue([]);
    vi.spyOn(api, "getAssignableStaffUsers").mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={12} ticketStatus="Open" csrfToken="csrf" />);
    await user.click(await screen.findByRole("button", { name: "Add action" }));
    await user.selectOptions(screen.getByLabelText("Status"), "COMPLETED");
    await user.type(screen.getByLabelText("Description"), "Finish work");
    await user.click(screen.getByRole("button", { name: "Save action" }));
    expect(await screen.findByText("A result is required for a completed action.")).toBeInTheDocument();
  });

  it("creates an action and displays revision history", async () => {
    vi.spyOn(api, "fetchActions").mockResolvedValueOnce([]).mockResolvedValueOnce([action]);
    vi.spyOn(api, "getAssignableStaffUsers").mockResolvedValue([]);
    const create = vi.spyOn(api, "createAction").mockResolvedValue(action);
    vi.spyOn(api, "fetchActionRevisions").mockResolvedValue([{ id: 1, actionTakenId: 7, revision: 1, editedBy: { id: 2, name: "Staff" }, editedAt: action.createdAt, status: "PLANNED", assigneeId: 2, actionAt: action.actionAt, description: action.description, result: "", followUpRequired: false, followUpNote: "", attachmentNotes: "" }]);
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={12} ticketStatus="Open" csrfToken="csrf" />);
    await user.click(await screen.findByRole("button", { name: "Add action" }));
    await user.type(screen.getByLabelText("Description"), "Check network");
    await user.click(screen.getByRole("button", { name: "Save action" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    await user.click(await screen.findByRole("button", { name: "History" }));
    expect(await screen.findByText("Revision 1")).toBeInTheDocument();
  });
});

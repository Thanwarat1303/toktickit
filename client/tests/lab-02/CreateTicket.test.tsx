import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CreateTicketForm from "../../src/CreateTicketForm.js";
import * as api from "../../src/api.js";

const requester: api.Requester = {
  id: 1,
  name: "Anan Student",
  email: "anan.student@toktickit.local",
};

function mockReferenceData() {
  vi.spyOn(api, "checkSystem").mockResolvedValue({
    online: true,
    categories: [{ id: 1, name: "Hardware" }],
  });
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([
    { id: 2, name: "Campus Wi-Fi" },
  ]);
}

describe("Create Ticket form", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows field messages and does not call the API when required values are missing", async () => {
    mockReferenceData();
    const createTicket = vi.spyOn(api, "createTicket");
    render(<CreateTicketForm requester={requester} />);

    await screen.findByRole("option", { name: "Hardware" });
    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));

    expect(screen.getByText("Please choose a category.")).toBeInTheDocument();
    expect(screen.getByText("Please choose a related system.")).toBeInTheDocument();
    expect(screen.getByText("Summary is required.")).toBeInTheDocument();
    expect(screen.getByText("Description is required.")).toBeInTheDocument();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("submits valid values as the active requester and shows the returned ticket number", async () => {
    mockReferenceData();
    vi.spyOn(api, "createTicket").mockResolvedValue({
      id: 1,
      ticketNumber: "TK-000001",
      status: "New",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 2,
      summary: "Wi-Fi is unavailable",
      description: "My laptop cannot connect to the campus network.",
      priority: "Medium",
      createdAt: "2026-09-05T10:00:00.000Z",
    });
    render(<CreateTicketForm requester={requester} />);

    fireEvent.change(await screen.findByLabelText(/^Category/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/^Related System/), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/^Summary/), { target: { value: "Wi-Fi is unavailable" } });
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "My laptop cannot connect to the campus network." } });
    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));

    expect(await screen.findByText("TK-000001")).toBeInTheDocument();
    expect(api.createTicket).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 1 }));
  });

  it("keeps the entered form data visible when the API rejects submission", async () => {
    mockReferenceData();
    vi.spyOn(api, "createTicket").mockRejectedValue(
      new api.ApiRequestError("A matching ticket was submitted recently")
    );
    render(<CreateTicketForm requester={requester} />);

    fireEvent.change(await screen.findByLabelText(/^Category/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/^Related System/), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/^Summary/), { target: { value: "Wi-Fi is unavailable" } });
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "My laptop cannot connect to the campus network." } });
    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A matching ticket was submitted recently");
    expect(screen.getByLabelText(/^Summary/)).toHaveValue("Wi-Fi is unavailable");
  });
});

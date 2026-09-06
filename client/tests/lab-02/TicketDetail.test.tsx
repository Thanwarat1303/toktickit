import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TicketDetail from "../../src/TicketDetail.js";
import * as api from "../../src/api.js";

const requester: api.Requester = {
  id: 1,
  name: "Anan Student",
  email: "anan.student@toktickit.local",
};

const ticket: api.TicketDetail = {
  id: 10,
  ticketNumber: "TK-000010",
  requester,
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 2, name: "Campus Wi-Fi" },
  summary: "Laptop cannot connect",
  description: "The laptop cannot connect to the campus Wi-Fi.",
  priority: "High",
  status: "New",
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T11:00:00.000Z",
};

describe("Ticket Detail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the selected ticket information and attachments", async () => {
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket);
    vi.spyOn(api, "getTicketAttachments").mockResolvedValue([
      {
        id: 5,
        ticketId: 10,
        originalFilename: "wifi-error.png",
        mimeType: "image/png",
        sizeBytes: 2048,
        createdAt: "2026-09-01T10:05:00.000Z",
        removedAt: null,
        removalReason: null,
      },
    ]);

    render(<TicketDetail requester={requester} ticketId={10} onBack={vi.fn()} />);

    expect(await screen.findByText("TK-000010")).toBeInTheDocument();
    expect(screen.getByText("Laptop cannot connect")).toBeInTheDocument();
    expect(screen.getByText("wifi-error.png")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download/i })).toHaveAttribute(
      "href",
      "http://localhost:3000/api/attachments/5/download?requesterId=1"
    );
  });

  it("soft-removes an attachment after the requester gives a reason", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Wrong file");
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket);
    vi.spyOn(api, "getTicketAttachments").mockResolvedValue([
      {
        id: 5,
        ticketId: 10,
        originalFilename: "old-file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        createdAt: "2026-09-01T10:05:00.000Z",
        removedAt: null,
        removalReason: null,
      },
    ]);
    vi.spyOn(api, "removeAttachment").mockResolvedValue({
      id: 5,
      ticketId: 10,
      originalFilename: "old-file.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      createdAt: "2026-09-01T10:05:00.000Z",
      removedAt: "2026-09-01T12:00:00.000Z",
      removalReason: "Wrong file",
    });

    render(<TicketDetail requester={requester} ticketId={10} onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /Remove/i }));

    await waitFor(() => {
      expect(api.removeAttachment).toHaveBeenCalledWith(5, 1, "Wrong file");
    });
    expect(await screen.findByText(/Wrong file/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Download/i })).not.toBeInTheDocument();
  });

  it("uploads a selected attachment and refreshes the attachment list", async () => {
    const uploadFile = new File(["ticket evidence"], "ticket-evidence.pdf", {
      type: "application/pdf",
    });
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket);
    vi.spyOn(api, "getTicketAttachments")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 6,
          ticketId: 10,
          originalFilename: "ticket-evidence.pdf",
          mimeType: "application/pdf",
          sizeBytes: uploadFile.size,
          createdAt: "2026-09-01T12:00:00.000Z",
          removedAt: null,
          removalReason: null,
        },
      ]);
    vi.spyOn(api, "uploadTicketAttachment").mockResolvedValue({
      id: 6,
      ticketId: 10,
      originalFilename: "ticket-evidence.pdf",
      mimeType: "application/pdf",
      sizeBytes: uploadFile.size,
      createdAt: "2026-09-01T12:00:00.000Z",
      removedAt: null,
      removalReason: null,
    });

    render(<TicketDetail requester={requester} ticketId={10} onBack={vi.fn()} />);

    const fileInput = await screen.findByLabelText(/Add an attachment/i);
    fireEvent.change(fileInput, { target: { files: [uploadFile] } });
    fireEvent.click(screen.getByRole("button", { name: /Upload attachment/i }));

    await waitFor(() => {
      expect(api.uploadTicketAttachment).toHaveBeenCalledWith(10, 1, uploadFile);
    });
    expect(await screen.findByText("Attachment uploaded successfully.")).toBeInTheDocument();
    expect(await screen.findByText("ticket-evidence.pdf")).toBeInTheDocument();
  });

  it("blocks unsupported files before calling the upload API", async () => {
    const unsupportedFile = new File(["bad"], "malware.exe", {
      type: "application/x-msdownload",
    });
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket);
    vi.spyOn(api, "getTicketAttachments").mockResolvedValue([]);
    const uploadSpy = vi.spyOn(api, "uploadTicketAttachment").mockResolvedValue({
      id: 6,
      ticketId: 10,
      originalFilename: "malware.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: unsupportedFile.size,
      createdAt: "2026-09-01T12:00:00.000Z",
      removedAt: null,
      removalReason: null,
    });

    render(<TicketDetail requester={requester} ticketId={10} onBack={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/Add an attachment/i), {
      target: { files: [unsupportedFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: /Upload attachment/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Unsupported file type/i);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("disables attachment upload when the ticket already has five active attachments", async () => {
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket);
    vi.spyOn(api, "getTicketAttachments").mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        ticketId: 10,
        originalFilename: `evidence-${index + 1}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 1024,
        createdAt: "2026-09-01T10:05:00.000Z",
        removedAt: null,
        removalReason: null,
      }))
    );

    render(<TicketDetail requester={requester} ticketId={10} onBack={vi.fn()} />);

    expect(await screen.findByLabelText(/Add an attachment \(5\/5\)/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /Upload attachment/i })).toBeDisabled();
    expect(screen.getByText(/Attachment limit reached/i)).toBeInTheDocument();
  });

  it("returns to My Tickets when Back is clicked", async () => {
    const onBack = vi.fn();
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket);
    vi.spyOn(api, "getTicketAttachments").mockResolvedValue([]);

    render(<TicketDetail requester={requester} ticketId={10} onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: /Back to My Tickets/i }));

    expect(onBack).toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RequesterDashboard from "../../src/RequesterDashboard.js";
import StaffDashboard from "../../src/StaffDashboard.js";
import * as api from "../../src/api.js";

afterEach(() => vi.restoreAllMocks());

describe("Lab 4 dashboards", () => {
  it("shows Requester metrics and real drill-down links", async () => {
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue({
      generatedAt: "2026-11-01T00:00:00.000Z", timezone: "Asia/Bangkok", openTickets: 2, waitingForRequester: 1,
      recentlyUpdated: [{ id: 7, ticketNumber: "TK-000007", summary: "Wi-Fi", currentStatus: "Open", itPriority: "MEDIUM", updatedAt: "2026-11-01T00:00:00.000Z" }],
      recentlyResolved: [],
    });
    render(<RequesterDashboard />);
    expect(await screen.findByText("Open tickets")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View 2 open tickets" })).toHaveAttribute("href", "#/my-tickets?open=1");
    expect(screen.getByRole("link", { name: "TK-000007" })).toHaveAttribute("href", "#/my-tickets/7");
  });

  it("shows zero states and a New Ticket action for an empty Requester", async () => {
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue({ generatedAt: "2026-11-01T00:00:00.000Z", timezone: "Asia/Bangkok", openTickets: 0, waitingForRequester: 0, recentlyUpdated: [], recentlyResolved: [] });
    render(<RequesterDashboard />);
    expect(await screen.findByText("You have no tickets yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Ticket" })).toHaveAttribute("href", "#/new-ticket");
    expect(screen.getAllByText("Nothing here")).toHaveLength(2);
  });

  it("shows Staff metrics, zero-filled status cards and Administrator controls", async () => {
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue({
      generatedAt: "2026-11-01T00:00:00.000Z", timezone: "Asia/Bangkok", unassigned: 3, assignedToMe: 1, ticketsWithMyOpenActions: 0,
      myRecentActions: [], byStatus: { New: 1, Open: 2, "In Progress": 0, "Waiting for Requester": 0, Resolved: 0, Closed: 0, Reopened: 0, Cancelled: 0 },
      byItPriority: { LOW: 2, MEDIUM: 1, HIGH: 0, URGENT: 0 }, recentlyUpdated: [], userCounts: { total: 18, active: 15, inactive: 3, byRole: {} },
    });
    render(<StaffDashboard />);
    expect(await screen.findByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View 3 unassigned tickets" })).toHaveAttribute("href", "#/queue?ownerId=unassigned&open=1");
    expect(screen.getByRole("link", { name: "Manage users" })).toHaveAttribute("href", "#/users");
    expect(screen.getByText("Users: 18 total, 15 active")).toBeInTheDocument();
  });

  it("clears stale dashboard content while retrying after an error", async () => {
    const fetcher = vi.spyOn(api, "fetchRequesterDashboard").mockRejectedValueOnce(new Error("offline"));
    render(<RequesterDashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load the dashboard.");
    fetcher.mockResolvedValueOnce({ generatedAt: "2026-11-01T00:00:00.000Z", timezone: "Asia/Bangkok", openTickets: 1, waitingForRequester: 0, recentlyUpdated: [], recentlyResolved: [] });
    screen.getByRole("button", { name: "Retry" }).click();
    expect(await screen.findByRole("status")).toHaveTextContent("Loading dashboard");
    expect(await screen.findByText("Open tickets")).toBeInTheDocument();
  });
});

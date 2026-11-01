import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the login screen when no session exists", async () => {
    vi.spyOn(api, "getCurrentUser").mockRejectedValue(new Error("No session"));
    render(<App />);
    expect(await screen.findByRole("heading", { name: /sign in to toktickit/i })).toBeInTheDocument();
  });

  it("requires a password change before normal navigation", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({ user: { id: 1, name: "Anan", email: "anan@test.local", role: "REQUESTER", isActive: true, mustChangePassword: true }, csrfToken: "csrf" });
    render(<App />);
    expect(await screen.findByRole("heading", { name: /choose a new password/i })).toBeInTheDocument();
  });

  it("gives an Administrator access to the Ticket Queue as well as User Management", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({ user: { id: 1, name: "Admin", email: "admin@test.local", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false }, csrfToken: "csrf" });
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
    vi.spyOn(api, "getStaffTickets").mockResolvedValue({ tickets: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } });
    vi.spyOn(api, "getManagedUsers").mockResolvedValue([]);
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue({ generatedAt: "2026-11-01T00:00:00.000Z", timezone: "Asia/Bangkok", unassigned: 0, assignedToMe: 0, ticketsWithMyOpenActions: 0, myRecentActions: [], byStatus: {}, byItPriority: {}, recentlyUpdated: [] });

    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ticket Queue" }));
    expect(await screen.findByRole("heading", { name: /ticket queue/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "User Management" }));
    expect(await screen.findByRole("heading", { name: /user management/i })).toBeInTheDocument();
  });
});

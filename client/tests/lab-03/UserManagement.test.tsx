import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserManagement from "../../src/UserManagement.js";
import * as api from "../../src/api.js";

const user: api.ManagedUser = { id: 7, name: "Admin User", email: "admin@example.test", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false, createdAt: "2026-10-01", updatedAt: "2026-10-01" };
describe("User management", () => {
  afterEach(() => vi.restoreAllMocks());
  it("lists users, filters by role, and submits a valid create request", async () => {
    const list = vi.spyOn(api, "getManagedUsers").mockResolvedValue([user]);
    const create = vi.spyOn(api, "createManagedUser").mockResolvedValue(user);
    render(<UserManagement csrfToken="csrf-token" />);
    expect(await screen.findByText("Admin User")).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText("Role", { selector: "select" })[0], { target: { value: "IT_STAFF" } });
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ search: "", role: "IT_STAFF" }));
    fireEvent.change(screen.getByLabelText("Name", { selector: "input" }), { target: { value: "New Staff" } });
    fireEvent.change(screen.getByLabelText("Email", { selector: "input" }), { target: { value: "new.staff@example.test" } });
    fireEvent.change(screen.getByLabelText("Initial password"), { target: { value: "SecurePass123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "New Staff", email: "new.staff@example.test" }), "csrf-token"));
  });
});

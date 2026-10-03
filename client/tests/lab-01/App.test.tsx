import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
});

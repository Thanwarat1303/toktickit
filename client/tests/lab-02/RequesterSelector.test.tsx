import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import RequesterSelector from "../../src/RequesterSelector.js";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const activeRequesters: api.Requester[] = [
  {
    id: 1,
    name: "Anan Student",
    email: "anan.student@toktickit.local",
  },
  {
    id: 2,
    name: "Benja Student",
    email: "benja.student@toktickit.local",
  },
];

describe("Development Requester selector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("loads active requesters and requires a selection", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue(activeRequesters);

    render(<RequesterSelector onSelect={vi.fn()} />);

    expect(screen.getByText(/Loading requesters/i)).toBeInTheDocument();
    expect(await screen.findByText(/Anan Student/)).toBeInTheDocument();
    expect(screen.getByText(/Benja Student/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue as requester/i })
    ).toBeDisabled();
  });

  it("returns the selected requester when Continue is clicked", async () => {
    const onSelect = vi.fn();
    vi.spyOn(api, "getRequesters").mockResolvedValue(activeRequesters);

    render(<RequesterSelector onSelect={onSelect} />);

    const select = await screen.findByRole("combobox", {
      name: /Requester/i,
    });
    fireEvent.change(select, { target: { value: "2" } });
    fireEvent.click(
      screen.getByRole("button", { name: /Continue as requester/i })
    );

    expect(onSelect).toHaveBeenCalledWith(activeRequesters[1]);
  });

  it("keeps the selected requester until the user changes it", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue(activeRequesters);

    const view = render(<App />);

    fireEvent.change(await screen.findByRole("combobox", {
      name: /Requester/i,
    }), {
      target: { value: "1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Continue as requester/i })
    );

    expect(screen.getByText(/Welcome, Anan Student/i)).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem("toktickit.developmentRequester") ?? "{}")
    ).toEqual(activeRequesters[0]);

    view.unmount();
    render(<App />);

    expect(screen.getByText(/Welcome, Anan Student/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Change requester/i })
    );
    expect(localStorage.getItem("toktickit.developmentRequester")).toBeNull();
    expect(
      await screen.findByText(/Select a Development Requester/i)
    ).toBeInTheDocument();
  });

  it("shows a useful error when the API is unavailable", async () => {
    vi.spyOn(api, "getRequesters").mockRejectedValue(
      new Error("API unavailable")
    );

    render(<RequesterSelector onSelect={vi.fn()} />);

    expect(
      await screen.findByText(/Requester list unavailable/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { getStaffTickets, getTickets } from "../../src/api.js";

const emptyResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({}),
});

describe("dashboard drill-down query serialization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("encodes requester open and recent filters as the server's 1 flags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse());
    vi.stubGlobal("fetch", fetchMock);

    await getTickets({ open: true, recent: true, page: 1 });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("open")).toBe("1");
    expect(url.searchParams.get("recent")).toBe("1");
    expect(url.searchParams.get("page")).toBe("1");
  });

  it("encodes staff open and recent filters as the server's 1 flags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse());
    vi.stubGlobal("fetch", fetchMock);

    await getStaffTickets({ open: true, recent: true, ownerId: "me" });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("open")).toBe("1");
    expect(url.searchParams.get("recent")).toBe("1");
    expect(url.searchParams.get("ownerId")).toBe("me");
  });

  it("does not send false boolean filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse());
    vi.stubGlobal("fetch", fetchMock);

    await getTickets({ open: false, recent: false });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.has("open")).toBe(false);
    expect(url.searchParams.has("recent")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { briefDescription, countsByKey, recentWindowStart } from "../../src/dashboard.js";

describe("Lab 4 dashboard helpers and authorization", () => {
  it("cuts action descriptions by characters and preserves emoji", () => {
    expect(briefDescription("a".repeat(120))).toBe("a".repeat(120));
    expect(briefDescription("a".repeat(121))).toBe(`${"a".repeat(120)}…`);
    expect([...briefDescription("😀".repeat(130))]).toHaveLength(121);
  });

  it("zero-fills every dashboard bucket", () => {
    expect(countsByKey(["New", "Open", "Resolved"] as const, [{ key: "Open", n: 2 }])).toEqual({ New: 0, Open: 2, Resolved: 0 });
  });

  it("computes the Bangkok midnight six days ago independently of the server timezone", () => {
    expect(recentWindowStart(new Date("2026-10-31T10:00:00.000Z")).toISOString()).toBe("2026-10-24T17:00:00.000Z");
  });

  it("requires authentication and the staff role", async () => {
    await request(app).get("/api/dashboard/staff").expect(401);
    await request(app).get("/api/dashboard/requester").expect(401);
  });
});

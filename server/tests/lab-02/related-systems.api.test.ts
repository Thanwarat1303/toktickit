import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/related-systems", () => {
  it("returns active related systems only, in id order", async () => {
    const response = await request(app).get("/api/related-systems");

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(6);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Email" }),
        expect.objectContaining({ name: "Campus Wi-Fi" }),
      ])
    );
    expect(response.body).not.toContainEqual(
      expect.objectContaining({ name: "Legacy Student Portal" })
    );
    expect(response.body.map((system: { id: number }) => system.id)).toEqual(
      [...response.body.map((system: { id: number }) => system.id)].sort((a: number, b: number) => a - b)
    );
  });
});

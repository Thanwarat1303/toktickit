import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("legacy requester selector API", () => {
  it("is removed so a browser cannot choose another requester's identity", async () => {
    const response = await request(app).get("/api/requesters");
    expect(response.status).toBe(404);
  });
});

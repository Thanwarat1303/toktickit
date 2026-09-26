import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("authentication API validation", () => {
  it("rejects malformed login input without touching the database", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "not-an-email", password: "" });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Email and password are required." },
    });
  });

  it("rejects current-user access without a session", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects logout without a session", async () => {
    const response = await request(app).post("/api/auth/logout");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });
});

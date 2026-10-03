import { afterAll, beforeAll, describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { createRequesterSession, removeRequesterSession, type RequesterSessionFixture } from "../helpers/requester-session.js";

let fixture: RequesterSessionFixture;

beforeAll(async () => { fixture = await createRequesterSession("categories"); });
afterAll(async () => { await removeRequesterSession(fixture); });

describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const response = await fixture.agent.get("/api/categories");

    expect(response.status).toBe(200);

    expect(response.body).toEqual([
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
      { id: 3, name: "Software" },
      { id: 4, name: "Network" },
    ]);
  });

  it("requires an authenticated, up-to-date session", async () => {
    expect((await request(app).get("/api/categories")).status).toBe(401);
  });
});

import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("GET /api/requesters", () => {
  it("returns only active Development Requesters in id order", async () => {
    const prisma = getPrisma();
    const expectedRequesters = await prisma.requester.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expectedRequesters);
    expect(response.body).toHaveLength(4);
  });

  it("does not expose inactive Development Requesters", async () => {
    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);
    expect(response.body).not.toContainEqual(
      expect.objectContaining({
        email: "inactive.requester@toktickit.local",
      })
    );
  });
});

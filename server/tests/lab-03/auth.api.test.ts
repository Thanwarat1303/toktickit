import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword, resetRateLimits } from "../../src/auth.js";

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
    const response = await request(app).post("/api/auth/logout").set("Origin", "http://localhost:5173");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("authentication API flows", () => {
  const password = "FixturePass123!";
  const origin = "http://localhost:5173";
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const activeEmail = `auth-flow-${suffix}@example.test`;
  const inactiveEmail = `auth-inactive-${suffix}@example.test`;
  const rateEmail = `auth-rate-${suffix}@example.test`;
  let activeId: number;
  let inactiveId: number;
  let rateId: number;

  beforeEach(() => resetRateLimits());

  beforeAll(async () => {
    const prisma = getPrisma();
    const passwordHash = await hashPassword(password);
    const active = await prisma.user.create({
      data: { name: "Auth Flow User", email: activeEmail, role: "REQUESTER", passwordHash, isActive: true, mustChangePassword: true },
    });
    const inactive = await prisma.user.create({
      data: { name: "Inactive Auth User", email: inactiveEmail, role: "REQUESTER", passwordHash, isActive: false, mustChangePassword: true },
    });
    const rate = await prisma.user.create({
      data: { name: "Rate Limited User", email: rateEmail, role: "REQUESTER", passwordHash, isActive: true, mustChangePassword: false },
    });
    activeId = active.id;
    inactiveId = inactive.id;
    rateId = rate.id;
  });

  afterAll(async () => {
    if (!activeId || !inactiveId || !rateId) return;
    const prisma = getPrisma();
    await prisma.session.deleteMany({ where: { userId: { in: [activeId, inactiveId, rateId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [activeId, inactiveId, rateId] } } });
  });

  it("logs in successfully with a safe user and CSRF token", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: activeEmail, password }).expect(200);
    expect(response.body.user).toMatchObject({ id: activeId, email: activeEmail, role: "REQUESTER", mustChangePassword: true });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.csrfToken).toEqual(expect.any(String));
    expect(response.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("toktickit_session=")]));
  });

  it("rejects wrong-password and inactive-account logins with the same safe 401", async () => {
    const wrong = await request(app).post("/api/auth/login").send({ email: activeEmail, password: "WrongPass123!" });
    const inactive = await request(app).post("/api/auth/login").send({ email: inactiveEmail, password });
    expect(wrong.status).toBe(401);
    expect(inactive.status).toBe(401);
    expect(inactive.body).toEqual(wrong.body);
  });

  it("locks an account after five failed attempts without revealing lock state", async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app).post("/api/auth/login").send({ email: rateEmail, password: "WrongPass123!" }).expect(401);
    }
    await request(app).post("/api/auth/login").send({ email: rateEmail, password }).expect(401);
  });

  it("invalidates the session on logout", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({ email: activeEmail, password }).expect(200);
    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/logout").set("Origin", origin).set("X-CSRF-Token", login.body.csrfToken).expect(204);
    await agent.get("/api/auth/me").expect(401);
  });

  it("changes password only with the correct current password and matching confirmation", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({ email: activeEmail, password }).expect(200);
    const csrf = login.body.csrfToken;
    await agent.post("/api/auth/change-password").set("Origin", origin).set("X-CSRF-Token", csrf).send({ currentPassword: "wrong", newPassword: "NewFixture123!", confirmPassword: "NewFixture123!" }).expect(400);
    await agent.post("/api/auth/change-password").set("Origin", origin).set("X-CSRF-Token", csrf).send({ currentPassword: password, newPassword: "NewFixture123!", confirmPassword: "mismatch" }).expect(400);
    const changed = await agent.post("/api/auth/change-password").set("Origin", origin).set("X-CSRF-Token", csrf).send({ currentPassword: password, newPassword: "NewFixture123!", confirmPassword: "NewFixture123!" }).expect(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
  });
});

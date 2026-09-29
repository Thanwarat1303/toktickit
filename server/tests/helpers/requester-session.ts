import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

export const TEST_ORIGIN = "http://localhost:5173";

export type RequesterSessionFixture = {
  agent: request.Agent;
  csrfToken: string;
  userId: number;
  requesterId: number;
  email: string;
};

export async function createRequesterSession(prefix: string): Promise<RequesterSessionFixture> {
  const prisma = getPrisma();
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const password = "FixturePass123!";
  const user = await prisma.user.create({
    data: {
      name: "Requester test fixture",
      email,
      passwordHash: await hashPassword(password),
      role: "REQUESTER",
      mustChangePassword: false,
    },
  });
  const requester = await prisma.requester.create({
    data: { userId: user.id, name: user.name, email: user.email },
  });
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({ email, password }).expect(200);
  return { agent, csrfToken: login.body.csrfToken, userId: user.id, requesterId: requester.id, email };
}

export async function removeRequesterSession(fixture: RequesterSessionFixture) {
  const prisma = getPrisma();
  await prisma.session.deleteMany({ where: { userId: fixture.userId } });
  await prisma.requester.delete({ where: { id: fixture.requesterId } });
  await prisma.user.delete({ where: { id: fixture.userId } });
}

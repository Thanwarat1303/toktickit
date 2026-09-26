import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { initialPassword, seedLab2Data } from "../../prisma/seed-data.js";

describe("Lab 3 data model migration and seed", () => {
  const prisma = getPrisma();

  it("seeds the required active and inactive user roles", async () => {
    const [activeRequesters, inactiveRequesters, activeStaff, inactiveStaff, admins] =
      await Promise.all([
        prisma.user.count({ where: { role: UserRole.REQUESTER, isActive: true } }),
        prisma.user.count({ where: { role: UserRole.REQUESTER, isActive: false } }),
        prisma.user.count({ where: { role: UserRole.IT_STAFF, isActive: true } }),
        prisma.user.count({ where: { role: UserRole.IT_STAFF, isActive: false } }),
        prisma.user.count({ where: { role: UserRole.ADMINISTRATOR, isActive: true } }),
      ]);

    expect(activeRequesters).toBeGreaterThanOrEqual(4);
    expect(inactiveRequesters).toBeGreaterThanOrEqual(1);
    expect(activeStaff).toBeGreaterThanOrEqual(3);
    expect(inactiveStaff).toBeGreaterThanOrEqual(1);
    expect(admins).toBeGreaterThanOrEqual(1);
  });

  it("preserves requester ownership links for existing tickets", async () => {
    const requesters = await prisma.requester.findMany({
      include: { user: true, tickets: true },
    });

    expect(requesters.length).toBeGreaterThanOrEqual(5);
    expect(requesters.every((requester) => requester.user?.role === UserRole.REQUESTER)).toBe(true);
    expect(requesters.every((requester) => requester.tickets.every((ticket) => ticket.requesterId === requester.id))).toBe(true);
  });

  it("stores seeded credentials as bcrypt hashes", async () => {
    const users = await prisma.user.findMany({ select: { passwordHash: true } });
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((user) => /^\$2[aby]?\$\d{2}\$/.test(user.passwordHash))).toBe(true);
    await expect(bcrypt.compare(initialPassword, users[0].passwordHash)).resolves.toBe(true);
  });

  it("keeps the Lab 3 seed idempotent", async () => {
    await seedLab2Data(prisma);
    await seedLab2Data(prisma);

    const [requesterUsers, staffUsers, administrators] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.REQUESTER } }),
      prisma.user.count({ where: { role: UserRole.IT_STAFF } }),
      prisma.user.count({ where: { role: UserRole.ADMINISTRATOR } }),
    ]);

    expect(requesterUsers).toBe(5);
    expect(staffUsers).toBe(4);
    expect(administrators).toBe(1);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});

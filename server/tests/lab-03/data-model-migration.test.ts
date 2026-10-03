import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { administrator, initialPassword, requesters, seedLab2Data, staffUsers } from "../../prisma/seed-data.js";

const requesterEmails = requesters.map((requester) => requester.email);
const staffEmails = staffUsers.map((staff) => staff.email);
const seedUserEmails = [...requesterEmails, ...staffEmails, administrator.email];

describe("Lab 3 data model migration and seed", () => {
  const prisma = getPrisma();

  it("seeds the required active and inactive user roles", async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: seedUserEmails } },
      select: { email: true, role: true, isActive: true },
    });
    const byEmail = new Map(users.map((user) => [user.email, user]));

    expect(users).toHaveLength(seedUserEmails.length);
    for (const requester of requesters) {
      expect(byEmail.get(requester.email)).toMatchObject({
        role: UserRole.REQUESTER,
        isActive: requester.isActive,
      });
    }
    for (const staff of staffUsers) {
      expect(byEmail.get(staff.email)).toMatchObject({
        role: UserRole.IT_STAFF,
        isActive: staff.isActive,
      });
    }
    expect(byEmail.get(administrator.email)).toMatchObject({
      role: UserRole.ADMINISTRATOR,
      isActive: true,
    });
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
    const users = await prisma.user.findMany({
      where: { email: { in: seedUserEmails } },
      select: { email: true, passwordHash: true },
    });
    expect(users).toHaveLength(seedUserEmails.length);
    expect(users.every((user) => /^\$2[aby]?\$\d{2}\$/.test(user.passwordHash))).toBe(true);
    await expect(Promise.all(users.map((user) => bcrypt.compare(initialPassword, user.passwordHash)))).resolves.toEqual(
      Array(users.length).fill(true),
    );
  });

  it("keeps the Lab 3 seed idempotent", async () => {
    await seedLab2Data(prisma);
    await seedLab2Data(prisma);

    const [requesterUsers, seededStaffUsers, administrators] = await Promise.all([
      prisma.user.count({ where: { email: { in: requesterEmails }, role: UserRole.REQUESTER } }),
      prisma.user.count({ where: { email: { in: staffEmails }, role: UserRole.IT_STAFF } }),
      prisma.user.count({ where: { email: administrator.email, role: UserRole.ADMINISTRATOR } }),
    ]);

    expect(requesterUsers).toBe(requesters.length);
    expect(seededStaffUsers).toBe(staffUsers.length);
    expect(administrators).toBe(1);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});

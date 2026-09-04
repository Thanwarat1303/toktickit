import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Lab 2 data model and seed data", () => {
  it("contains the four required active categories", async () => {
    const requiredNames = [
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ];

    const categories = await prisma.category.findMany({
      where: {
        name: {
          in: requiredNames,
        },
      },
      select: {
        name: true,
        isActive: true,
      },
    });

    expect(categories).toHaveLength(4);
    expect(categories.every((category) => category.isActive)).toBe(true);
    expect(categories.map((category) => category.name).sort()).toEqual(
      [...requiredNames].sort(),
    );
  });

  it("contains at least six active related systems", async () => {
    const seededNames = [
      "Email",
      "Campus Wi-Fi",
      "VPN",
      "LEB2 App",
      "Grade Submission App",
      "Printer",
      "Corporate Laptop",
    ];

    const relatedSystems = await prisma.relatedSystem.findMany({
      where: {
        name: {
          in: seededNames,
        },
      },
      select: {
        name: true,
        isActive: true,
      },
    });

    expect(relatedSystems).toHaveLength(7);
    expect(relatedSystems.every((system) => system.isActive)).toBe(true);
    expect(new Set(relatedSystems.map((system) => system.name)).size).toBe(7);
  });

  it("contains four active and one inactive development requester", async () => {
    const seededEmails = [
      "anan.student@toktickit.local",
      "benja.student@toktickit.local",
      "chalida.student@toktickit.local",
      "danai.student@toktickit.local",
      "inactive.requester@toktickit.local",
    ];

    const requesters = await prisma.requester.findMany({
      where: {
        email: {
          in: seededEmails,
        },
      },
      select: {
        email: true,
        isActive: true,
      },
    });

    const activeRequesters = requesters.filter(
      (requester) => requester.isActive,
    );
    const inactiveRequesters = requesters.filter(
      (requester) => !requester.isActive,
    );

    expect(requesters).toHaveLength(5);
    expect(activeRequesters).toHaveLength(4);
    expect(inactiveRequesters).toHaveLength(1);
    expect(new Set(requesters.map((requester) => requester.email)).size).toBe(5);
  });
});
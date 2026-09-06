import { afterAll, describe, expect, it } from "vitest";
import {
  categories,
  relatedSystems,
  requesters,
  seedLab2Data,
} from "../../prisma/seed-data.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

const activeCategoryNames = categories
  .filter((category) => category.isActive)
  .map((category) => category.name);

const activeRelatedSystemNames = relatedSystems
  .filter((system) => system.isActive)
  .map((system) => system.name);

const seededRequesterEmails = requesters.map(
  (requester) => requester.email,
);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Lab 2 data model and seed data", () => {
  it("contains the four required active categories", async () => {
    const seededCategories = await prisma.category.findMany({
      where: {
        name: {
          in: activeCategoryNames,
        },
      },
      select: {
        name: true,
        isActive: true,
      },
    });

    expect(seededCategories).toHaveLength(4);
    expect(
      seededCategories.every((category) => category.isActive),
    ).toBe(true);

    expect(
      seededCategories.map((category) => category.name).sort(),
    ).toEqual([...activeCategoryNames].sort());
  });

  it("contains at least six active related systems", async () => {
    const seededSystems = await prisma.relatedSystem.findMany({
      where: {
        name: {
          in: activeRelatedSystemNames,
        },
      },
      select: {
        name: true,
        isActive: true,
      },
    });

    expect(seededSystems).toHaveLength(7);
    expect(seededSystems.length).toBeGreaterThanOrEqual(6);
    expect(seededSystems.every((system) => system.isActive)).toBe(true);

    expect(
      new Set(seededSystems.map((system) => system.name)).size,
    ).toBe(7);
  });

  it("contains four active and one inactive development requester", async () => {
    const seededRequesters = await prisma.requester.findMany({
      where: {
        email: {
          in: seededRequesterEmails,
        },
      },
      select: {
        email: true,
        isActive: true,
      },
    });

    const activeRequesters = seededRequesters.filter(
      (requester) => requester.isActive,
    );

    const inactiveRequesters = seededRequesters.filter(
      (requester) => !requester.isActive,
    );

    expect(seededRequesters).toHaveLength(5);
    expect(activeRequesters).toHaveLength(4);
    expect(inactiveRequesters).toHaveLength(1);

    expect(
      new Set(seededRequesters.map((requester) => requester.email)).size,
    ).toBe(5);
  });

  it("contains inactive category and related system fixtures", async () => {
    const inactiveCategory = await prisma.category.findUnique({
      where: {
        name: "Legacy Service",
      },
    });

    const inactiveRelatedSystem =
      await prisma.relatedSystem.findUnique({
        where: {
          name: "Legacy Student Portal",
        },
      });

    expect(inactiveCategory).not.toBeNull();
    expect(inactiveCategory?.isActive).toBe(false);

    expect(inactiveRelatedSystem).not.toBeNull();
    expect(inactiveRelatedSystem?.isActive).toBe(false);
  });

  it("can run the seed twice without creating duplicate data", async () => {
    await seedLab2Data(prisma);
    await seedLab2Data(prisma);

    const categoryCount = await prisma.category.count({
      where: {
        name: {
          in: categories.map((category) => category.name),
        },
      },
    });

    const relatedSystemCount = await prisma.relatedSystem.count({
      where: {
        name: {
          in: relatedSystems.map((system) => system.name),
        },
      },
    });

    const requesterCount = await prisma.requester.count({
      where: {
        email: {
          in: seededRequesterEmails,
        },
      },
    });

    expect(categoryCount).toBe(categories.length);
    expect(relatedSystemCount).toBe(relatedSystems.length);
    expect(requesterCount).toBe(requesters.length);
  });
});
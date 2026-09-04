import { PrismaClient } from "@prisma/client";

export const categories = [
  { name: "Account and Access", isActive: true },
  { name: "Hardware", isActive: true },
  { name: "Software", isActive: true },
  { name: "Network", isActive: true },
  { name: "Legacy Service", isActive: false },
];

export const relatedSystems = [
  { name: "Email", isActive: true },
  { name: "Campus Wi-Fi", isActive: true },
  { name: "VPN", isActive: true },
  { name: "LEB2 App", isActive: true },
  { name: "Grade Submission App", isActive: true },
  { name: "Printer", isActive: true },
  { name: "Corporate Laptop", isActive: true },
  { name: "Legacy Student Portal", isActive: false },
];

export const requesters = [
  {
    name: "Anan Student",
    email: "anan.student@toktickit.local",
    isActive: true,
  },
  {
    name: "Benja Student",
    email: "benja.student@toktickit.local",
    isActive: true,
  },
  {
    name: "Chalida Student",
    email: "chalida.student@toktickit.local",
    isActive: true,
  },
  {
    name: "Danai Student",
    email: "danai.student@toktickit.local",
    isActive: true,
  },
  {
    name: "Inactive Requester",
    email: "inactive.requester@toktickit.local",
    isActive: false,
  },
];

export async function seedLab2Data(prisma: PrismaClient) {
  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        name: category.name,
      },
      update: {
        isActive: category.isActive,
      },
      create: category,
    });
  }

  for (const system of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: {
        name: system.name,
      },
      update: {
        isActive: system.isActive,
      },
      create: system,
    });
  }

  for (const requester of requesters) {
    await prisma.requester.upsert({
      where: {
        email: requester.email,
      },
      update: {
        name: requester.name,
        isActive: requester.isActive,
      },
      create: requester,
    });
  }

  return {
    categoryCount: categories.length,
    relatedSystemCount: relatedSystems.length,
    requesterCount: requesters.length,
  };
}
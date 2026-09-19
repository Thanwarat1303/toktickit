import { PrismaClient, UserRole } from "@prisma/client";

const initialPasswordHash = "LAB3_INITIAL_PASSWORD_MUST_CHANGE";

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

export const staffUsers = [
  {
    name: "Kanya IT Staff",
    email: "kanya.staff@toktickit.local",
    isActive: true,
  },
  {
    name: "Narin IT Staff",
    email: "narin.staff@toktickit.local",
    isActive: true,
  },
  {
    name: "Pimchanok IT Staff",
    email: "pimchanok.staff@toktickit.local",
    isActive: true,
  },
  {
    name: "Inactive IT Staff",
    email: "inactive.staff@toktickit.local",
    isActive: false,
  },
];

export const administrator = {
  name: "System Administrator",
  email: "admin@toktickit.local",
  isActive: true,
};

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
    const user = await prisma.user.upsert({
      where: { email: requester.email },
      update: {
        name: requester.name,
        role: UserRole.REQUESTER,
        isActive: requester.isActive,
        mustChangePassword: true,
      },
      create: {
        ...requester,
        passwordHash: initialPasswordHash,
        role: UserRole.REQUESTER,
        mustChangePassword: true,
      },
    });

    await prisma.requester.upsert({
      where: {
        email: requester.email,
      },
      update: {
        name: requester.name,
        isActive: requester.isActive,
        userId: user.id,
      },
      create: { ...requester, userId: user.id },
    });
  }

  for (const staff of staffUsers) {
    await prisma.user.upsert({
      where: { email: staff.email },
      update: {
        name: staff.name,
        role: UserRole.IT_STAFF,
        isActive: staff.isActive,
        mustChangePassword: true,
      },
      create: {
        ...staff,
        passwordHash: initialPasswordHash,
        role: UserRole.IT_STAFF,
        mustChangePassword: true,
      },
    });
  }

  await prisma.user.upsert({
    where: { email: administrator.email },
    update: {
      name: administrator.name,
      role: UserRole.ADMINISTRATOR,
      isActive: administrator.isActive,
      mustChangePassword: true,
    },
    create: {
      ...administrator,
      passwordHash: initialPasswordHash,
      role: UserRole.ADMINISTRATOR,
      mustChangePassword: true,
    },
  });

  return {
    categoryCount: categories.length,
    relatedSystemCount: relatedSystems.length,
    requesterCount: requesters.length,
    staffCount: staffUsers.length,
    administratorCount: 1,
  };
}

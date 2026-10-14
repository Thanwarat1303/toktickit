import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

/** Development-only password. Every seeded account must change it after login. */
export const initialPassword = process.env.LAB3_INITIAL_PASSWORD ?? "LAB3_INITIAL_PASSWORD_MUST_CHANGE";
export const initialPasswordHash = bcrypt.hashSync(initialPassword, 12);

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
    const existingUser = await prisma.user.findUnique({ where: { email: requester.email }, select: { passwordHash: true, mustChangePassword: true } });
    const user = await prisma.user.upsert({
      where: { email: requester.email },
      update: {
        name: requester.name,
        role: UserRole.REQUESTER,
        isActive: requester.isActive,
        mustChangePassword: existingUser?.mustChangePassword ?? true,
        ...(existingUser?.mustChangePassword ? { passwordHash: initialPasswordHash } : {}),
      },
      create: {
        ...requester,
        passwordHash: initialPasswordHash,
        role: UserRole.REQUESTER,
        mustChangePassword: existingUser?.mustChangePassword ?? true,
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
    const existingUser = await prisma.user.findUnique({ where: { email: staff.email }, select: { passwordHash: true, mustChangePassword: true } });
    await prisma.user.upsert({
      where: { email: staff.email },
      update: {
        name: staff.name,
        role: UserRole.IT_STAFF,
        isActive: staff.isActive,
        mustChangePassword: existingUser?.mustChangePassword ?? true,
        ...(existingUser?.mustChangePassword ? { passwordHash: initialPasswordHash } : {}),
      },
      create: {
        ...staff,
        passwordHash: initialPasswordHash,
        role: UserRole.IT_STAFF,
        mustChangePassword: true,
      },
    });
  }

  const existingAdministrator = await prisma.user.findUnique({ where: { email: administrator.email }, select: { passwordHash: true, mustChangePassword: true } });
  await prisma.user.upsert({
    where: { email: administrator.email },
    update: {
      name: administrator.name,
      role: UserRole.ADMINISTRATOR,
      isActive: administrator.isActive,
      mustChangePassword: existingAdministrator?.mustChangePassword ?? true,
      ...(existingAdministrator?.mustChangePassword ? { passwordHash: initialPasswordHash } : {}),
    },
    create: {
      ...administrator,
      passwordHash: initialPasswordHash,
      role: UserRole.ADMINISTRATOR,
      mustChangePassword: true,
    },
  });

  // Lab 4 demo data. Fixed ticket numbers make the seed repeatable without
  // touching tickets created by users or API tests. These use the existing Lab
  // 3 status labels, which will be normalised by the workflow feature later.
  const categoryByName = new Map((await prisma.category.findMany()).map((item) => [item.name, item.id]));
  const systemByName = new Map((await prisma.relatedSystem.findMany()).map((item) => [item.name, item.id]));
  const requesterByEmail = new Map((await prisma.requester.findMany()).map((item) => [item.email, item.id]));
  const userByEmail = new Map((await prisma.user.findMany()).map((item) => [item.email, item.id]));

  const ticketSeeds = [
    ["001", "anan.student@toktickit.local", "Network", "Campus Wi-Fi", "Wi-Fi drops in the library", "Connection drops roughly once per hour.", "HIGH", "HIGH", "New", null],
    ["002", "anan.student@toktickit.local", "Software", "Email", "Cannot attach files larger than 5 MB", "Mail client rejects larger attachments.", "MEDIUM", "MEDIUM", "Open", "kanya.staff@toktickit.local"],
    ["003", "benja.student@toktickit.local", "Hardware", "Printer", "Printer reports a paper jam", "Tray is empty but the panel still reports a jam.", "LOW", "MEDIUM", "In Progress", "narin.staff@toktickit.local"],
    ["004", "benja.student@toktickit.local", "Account and Access", "VPN", "VPN rejects my credentials", "Works in the portal but not in the VPN client.", "HIGH", "HIGH", "Waiting for Requester", "pimchanok.staff@toktickit.local"],
    ["005", "chalida.student@toktickit.local", "Software", "LEB2 App", "LEB2 App export crashes", "PDF export crashes but CSV works.", "MEDIUM", "MEDIUM", "Resolved", "kanya.staff@toktickit.local"],
    ["006", "chalida.student@toktickit.local", "Hardware", "Corporate Laptop", "Laptop battery drains quickly", "Battery health is low and runtime is under one hour.", "LOW", "LOW", "Closed", "narin.staff@toktickit.local"],
    ["007", "danai.student@toktickit.local", "Account and Access", "Grade Submission App", "Course section is missing", "The assigned section disappeared after rollover.", "HIGH", "MEDIUM", "Reopened", "pimchanok.staff@toktickit.local"],
    ["008", "danai.student@toktickit.local", "Network", "Campus Wi-Fi", "Guest Wi-Fi portal does not load", "Captive portal times out on multiple devices.", "LOW", "LOW", "Cancelled", "kanya.staff@toktickit.local"],
    ["009", "anan.student@toktickit.local", "Hardware", "Printer", "Request a second monitor", "A second screen is needed for split-screen work.", "LOW", "LOW", "New", null],
    ["010", "benja.student@toktickit.local", "Software", "Email", "Calendar time zone is wrong", "Invites from other regions shift by one hour.", "MEDIUM", "HIGH", "Open", null],
    ["011", "chalida.student@toktickit.local", "Account and Access", "Email", "Need a shared mailbox", "Five team members need to read and send from one address.", "MEDIUM", "MEDIUM", "In Progress", "pimchanok.staff@toktickit.local"],
    ["012", "danai.student@toktickit.local", "Network", "VPN", "VPN download is slow", "Throughput falls below one MB/s for datasets.", "HIGH", "HIGH", "New", null],
  ] as const;

  for (const [number, requesterEmail, categoryName, systemName, summary, description, priority, itPriority, currentStatus, assigneeEmail] of ticketSeeds) {
    await prisma.ticket.upsert({
      where: { ticketNumber: `TKT-SEED-${number}` },
      update: {},
      create: {
        ticketNumber: `TKT-SEED-${number}`,
        requesterId: requesterByEmail.get(requesterEmail)!,
        categoryId: categoryByName.get(categoryName)!,
        relatedSystemId: systemByName.get(systemName)!,
        summary,
        description,
        priority,
        itPriority,
        currentStatus,
        assignedStaffId: assigneeEmail ? userByEmail.get(assigneeEmail)! : null,
      },
    });
  }

  const ticketByNumber = new Map((await prisma.ticket.findMany({ where: { ticketNumber: { startsWith: "TKT-SEED-" } } })).map((ticket) => [ticket.ticketNumber, ticket.id]));
  const actionSeeds = [
    ["002", "kanya.staff@toktickit.local", "kanya.staff@toktickit.local", "COMPLETED", "2026-10-01T09:30:00.000Z", "Raised the mail attachment limit", "Limit is now 25 MB and a 12 MB file was tested.", null],
    ["003", "narin.staff@toktickit.local", "narin.staff@toktickit.local", "COMPLETED", "2026-10-02T10:00:00.000Z", "Reseated the tray sensor", "Jam message still appears after reseating.", null],
    ["003", "narin.staff@toktickit.local", "narin.staff@toktickit.local", "IN_PROGRESS", "2026-10-03T14:00:00.000Z", "Replace the paper-path sensor", "", null],
    ["003", "narin.staff@toktickit.local", "narin.staff@toktickit.local", "PLANNED", "2026-10-03T14:00:00.000Z", "Order a spare sensor kit", "", "Check stock for other floor-three printers."],
    ["004", "pimchanok.staff@toktickit.local", "pimchanok.staff@toktickit.local", "PLANNED", "2026-10-04T08:15:00.000Z", "Check the VPN account lockout log", "", null],
    ["005", "kanya.staff@toktickit.local", "kanya.staff@toktickit.local", "COMPLETED", "2026-10-05T15:00:00.000Z", "Installed the report font patch", "PDF export works and no data was affected.", null],
    ["005", "kanya.staff@toktickit.local", null, "CANCELLED", "2026-10-05T11:00:00.000Z", "Rebuild the report server image", "Not needed once the patch worked.", null],
    ["006", "narin.staff@toktickit.local", "narin.staff@toktickit.local", "COMPLETED", "2026-10-06T13:20:00.000Z", "Replaced the battery under warranty", "Battery health returned to 100%.", null],
    ["007", "pimchanok.staff@toktickit.local", "pimchanok.staff@toktickit.local", "COMPLETED", "2026-10-07T09:00:00.000Z", "Re-synced the course section list", "Section is visible again.", null],
    ["007", "pimchanok.staff@toktickit.local", null, "IN_PROGRESS", "2026-10-07T16:00:00.000Z", "Review the rollover job", "", "Ask the platform team about enrolled sections."],
    ["008", "kanya.staff@toktickit.local", null, "CANCELLED", "2026-10-08T10:00:00.000Z", "Test the captive portal", "Requester cancelled the ticket.", null],
    ["011", "pimchanok.staff@toktickit.local", "pimchanok.staff@toktickit.local", "COMPLETED", "2026-10-09T11:00:00.000Z", "Created the shared mailbox", "Members confirmed they can read and send.", null],
  ] as const;

  for (const [ticketNumber, performedByEmail, assigneeEmail, status, actionAt, description, result, followUpNote] of actionSeeds) {
    const ticketId = ticketByNumber.get(`TKT-SEED-${ticketNumber}`)!;
    const existing = await prisma.actionTaken.findFirst({ where: { ticketId, description }, select: { id: true } });
    if (existing) continue;
    const values = {
      assigneeId: assigneeEmail ? userByEmail.get(assigneeEmail)! : null,
      status,
      actionAt: new Date(actionAt),
      description,
      result,
      followUpRequired: Boolean(followUpNote),
      followUpNote: followUpNote ?? "",
      attachmentNotes: "",
    };
    const performedById = userByEmail.get(performedByEmail)!;
    await prisma.$transaction(async (tx) => {
      const action = await tx.actionTaken.create({ data: { ticketId, performedById, ...values } });
      await tx.actionTakenRevision.create({
        data: { actionTakenId: action.id, revision: 1, editedById: performedById, editedAt: action.createdAt, ...values },
      });
    });
  }

  return {
    categoryCount: categories.length,
    relatedSystemCount: relatedSystems.length,
    requesterCount: requesters.length,
    staffCount: staffUsers.length,
    administratorCount: 1,
  };
}

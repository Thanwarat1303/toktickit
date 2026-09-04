import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

  const categories = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: {
        name,
        isActive: true,
      },
    });
  }

  const relatedSystems = [
    "Email",
    "Campus Wi-Fi",
    "VPN",
    "LEB2 App",
    "Grade Submission App",
    "Printer",
    "Corporate Laptop",
  ];

  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: {
        name,
        isActive: true,
      },
    });
  }

  const requesters = [
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

  for (const requester of requesters) {
    await prisma.requester.upsert({
      where: { email: requester.email },
      update: {
        name: requester.name,
        isActive: requester.isActive,
      },
      create: requester,
    });
  }

  console.log("Lab 2 seed completed.");
  console.log(`Categories: ${categories.length}`);
  console.log(`Related systems: ${relatedSystems.length}`);
  console.log(`Requesters: ${requesters.length}`);
}

main()
  .catch((error) => {
    console.error("Lab 2 seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
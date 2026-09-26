import { getPrisma } from "../src/prisma.js";
import { seedLab2Data } from "./seed-data.js";
import { hashPassword } from "../src/auth.js";

async function main() {
  const prisma = getPrisma();
  const result = await seedLab2Data(prisma);

  const initialPasswordHash = await hashPassword("ChangeMe123!");
  const seededUsers = [
    ...[
      ["Anan Student", "anan.student@toktickit.local", "REQUESTER"],
      ["Benja Student", "benja.student@toktickit.local", "REQUESTER"],
      ["Chalida Student", "chalida.student@toktickit.local", "REQUESTER"],
      ["Danai Student", "danai.student@toktickit.local", "REQUESTER"],
    ],
    ["IT Staff", "staff@toktickit.local", "IT_STAFF"],
    ["Administrator", "admin@toktickit.local", "ADMINISTRATOR"],
  ] as const;
  for (const [name, email, role] of seededUsers) {
    await prisma.user.upsert({
      where: { email },
      update: { name, role, isActive: true },
      create: { name, email, role, passwordHash: initialPasswordHash, mustChangePassword: true },
    });
  }

  console.log("Lab 2 seed completed.");
  console.log(`Categories: ${result.categoryCount}`);
  console.log(`Related systems: ${result.relatedSystemCount}`);
  console.log(`Requesters: ${result.requesterCount}`);
  console.log(`Users: ${seededUsers.length}`);
}

main()
  .catch((error) => {
    console.error("Lab 2 seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });

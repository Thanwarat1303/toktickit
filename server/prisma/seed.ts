import { getPrisma } from "../src/prisma.js";
import { seedLab2Data } from "./seed-data.js";

async function main() {
  const prisma = getPrisma();
  const result = await seedLab2Data(prisma);

  console.log("Lab 3 data-model seed completed.");
  console.log(`Categories: ${result.categoryCount}`);
  console.log(`Related systems: ${result.relatedSystemCount}`);
  console.log(`Requesters: ${result.requesterCount}`);
  console.log(`IT Staff: ${result.staffCount}`);
  console.log(`Administrators: ${result.administratorCount}`);
}

main()
  .catch((error) => {
    console.error("Lab 3 seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });

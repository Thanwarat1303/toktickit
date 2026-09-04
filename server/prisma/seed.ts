import { getPrisma } from "../src/prisma.js";
import { seedLab2Data } from "./seed-data.js";

async function main() {
  const prisma = getPrisma();
  const result = await seedLab2Data(prisma);

  console.log("Lab 2 seed completed.");
  console.log(`Categories: ${result.categoryCount}`);
  console.log(`Related systems: ${result.relatedSystemCount}`);
  console.log(`Requesters: ${result.requesterCount}`);
}

main()
  .catch((error) => {
    console.error("Lab 2 seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
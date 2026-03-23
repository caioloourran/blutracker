import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@blutracker.com" },
    update: {},
    create: {
      email: "admin@blutracker.com",
      passwordHash,
      name: "Admin",
    },
  });
  console.log("Seed complete: admin@blutracker.com / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

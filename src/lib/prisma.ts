import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 talks to PostgreSQL through the `pg` driver adapter.
// One client per process; reused across hot reloads in development.

const globalForPrisma = globalThis as unknown as { __snowberPrisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.__snowberPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__snowberPrisma = prisma;

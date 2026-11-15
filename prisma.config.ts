import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 reads the connection URL from here instead of schema.prisma.
// DATABASE_URL may be unset during `npm install` (postinstall runs `prisma generate`,
// which does not need a database), so it is read without throwing.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

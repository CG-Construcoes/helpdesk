import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { Pool } from "pg";

let connectionString = process.env.DATABASE_URL || "";
if (connectionString.includes("sslmode=require") && !connectionString.includes("uselibpqcompat=true")) {
  connectionString = connectionString.replace("sslmode=require", "uselibpqcompat=true&sslmode=require");
} else if (connectionString && !connectionString.includes("sslmode=")) {
  connectionString += connectionString.includes("?") ? "&sslmode=verify-full" : "?sslmode=verify-full";
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

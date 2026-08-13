import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Shared PrismaClient for all seeders (single connection, disconnected by the orchestrator). */
export const prisma: PrismaClient = new PrismaClient({
	adapter: new PrismaPg({
		connectionString: process.env.DATABASE_URL!,
	}),
});

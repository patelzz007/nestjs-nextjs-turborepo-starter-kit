import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * The seed's `application_name`: the data-change trail (ADR 051) records it
 * on every row change, so fixture writes are told apart from the API's.
 */
export const SEED_APPLICATION_NAME = "prisma-seed";

/**
 * One correlation id per seed run, set on every seed connection (`app.correlation_id`, session
 * level): the data-change trail groups a whole run's fixture writes into ONE audit-log entry
 * instead of one per statement. A seed write that stands for a seeded request overrides it
 * transaction-locally (attributed-session.ts).
 */
export const SEED_RUN_CORRELATION_ID = `seed-run-${randomUUID()}`;

/** Shared PrismaClient for all seeders (single connection, disconnected by the orchestrator). */
export const prisma: PrismaClient = new PrismaClient({
	adapter: new PrismaPg({
		connectionString: process.env.DATABASE_URL,
		application_name: SEED_APPLICATION_NAME,
		options: `-c app.correlation_id=${SEED_RUN_CORRELATION_ID}`,
	}),
});

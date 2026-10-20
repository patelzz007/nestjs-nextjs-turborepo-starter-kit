import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { SEED_DEMO_DATASET_OPERATION } from "../../src/prisma/seed-demo-dataset.operation";
import { DEFAULT_DATABASE_ROLE } from "../../src/prisma/system-operation.registry";
import { ACTOR_SETTING, SEED_ACTOR } from "../rls/row-audit";

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

/**
 * The session settings every seed connection starts with: its correlation id, its actor
 * (`app.actor = system:seed`, so the row audit triggers record every fixture row as created and
 * updated by the seed — prisma/rls/row-audit.ts), the role it acts as (`app_runtime`, reached with
 * `SET ROLE` exactly as the API reaches it), and the named system operation it writes under
 * (`seed.demo_dataset`). Every table forces RLS, so the seed passes a policy only through that
 * operation's registry scope (D24) — never through table ownership or a superuser login.
 */
export const SEED_SESSION_OPTIONS: string = [
	`-c app.correlation_id=${SEED_RUN_CORRELATION_ID}`,
	`-c ${ACTOR_SETTING}=${SEED_ACTOR}`,
	`-c role=${DEFAULT_DATABASE_ROLE}`,
	"-c app.rls_bypass=true",
	`-c app.system_operation=${SEED_DEMO_DATASET_OPERATION}`,
].join(" ");

/** Shared PrismaClient for all seeders (disconnected by the orchestrator), on {@link SEED_SESSION_OPTIONS}. */
export const prisma: PrismaClient = new PrismaClient({
	adapter: new PrismaPg({
		connectionString: process.env.DATABASE_URL,
		application_name: SEED_APPLICATION_NAME,
		options: SEED_SESSION_OPTIONS,
	}),
});

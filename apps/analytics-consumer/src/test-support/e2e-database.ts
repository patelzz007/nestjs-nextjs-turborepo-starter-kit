import pg from "pg";

import { parseConsumerLogin, provisionConsumerLogin } from "../db-login";
import { DEFAULT_DB_CONNECTION_TIMEOUT_MS, DEFAULT_DB_IDLE_TIMEOUT_MS, DEFAULT_DB_STATEMENT_TIMEOUT_MS, loadDbLoginProvisioningEnv } from "../env";
import type { ConsumerLogger } from "@workspace/messaging/inbox";
import { createConsumerPool } from "@workspace/messaging/inbox";

/** Small pool — the suites run one file at a time. */
const E2E_POOL_MAX = 3;

/**
 * Two connections for the e2e suites (they need migrations + `db:apply-security`):
 * - `consumer` — the least-privilege `analytics_consumer` login, exactly what the worker uses;
 * - `admin` — the migrating user, ONLY for fixtures (backdated rows) and cleanup.
 * The consumer login is (re)provisioned first, so a fresh database works out of the box.
 */
export interface E2eDatabase {
	readonly admin: pg.Pool;
	readonly consumer: pg.Pool;
}

export async function openE2eDatabase(): Promise<E2eDatabase> {
	const env = loadDbLoginProvisioningEnv();
	const admin = new pg.Pool({ connectionString: env.adminUrl, max: E2E_POOL_MAX });
	const client = await admin.connect();
	try {
		await provisionConsumerLogin(client, parseConsumerLogin(env.consumerUrl));
	} finally {
		client.release();
	}
	const consumer = createConsumerPool(env.consumerUrl, {
		max: E2E_POOL_MAX,
		connectionTimeoutMs: DEFAULT_DB_CONNECTION_TIMEOUT_MS,
		idleTimeoutMs: DEFAULT_DB_IDLE_TIMEOUT_MS,
		statementTimeoutMs: DEFAULT_DB_STATEMENT_TIMEOUT_MS,
	});
	return { admin, consumer };
}

export async function closeE2eDatabase(database: E2eDatabase): Promise<void> {
	await database.consumer.end();
	await database.admin.end();
}

export const SILENT_LOGGER: ConsumerLogger = {
	info: (): void => undefined,
	warn: (): void => undefined,
	error: (): void => undefined,
};

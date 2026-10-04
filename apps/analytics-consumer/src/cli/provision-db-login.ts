// `pnpm --filter @workspace/analytics-consumer db:provision-login`
// Creates / updates the consumer's least-privilege Postgres login from
// ANALYTICS_CONSUMER_DATABASE_URL, using ANALYTICS_CONSUMER_DB_ADMIN_URL.
import { EnvValidationError } from "@workspace/shared";
import pg from "pg";

import { parseConsumerLogin, provisionConsumerLogin } from "../db-login";
import { loadDbLoginProvisioningEnv } from "../env";
import { createConsoleJsonLogger } from "../logger";

const SERVICE_NAME = "analytics-consumer.db-provision-login";
const FAILURE_EXIT_CODE = 1;

async function run(): Promise<void> {
	const logger = createConsoleJsonLogger(SERVICE_NAME);
	try {
		const env = loadDbLoginProvisioningEnv();
		const login = parseConsumerLogin(env.consumerUrl);
		const admin = new pg.Client({ connectionString: env.adminUrl });
		await admin.connect();
		try {
			const outcome = await provisionConsumerLogin(admin, login);
			logger.info({ event: "analytics.db_login_provisioned", role: login.roleName, outcome });
		} finally {
			await admin.end();
		}
	} catch (error) {
		if (error instanceof EnvValidationError) {
			process.stderr.write(`${error.message}\n`);
		} else {
			logger.error({ event: "analytics.db_login_provisioning_failed", error: error instanceof Error ? error.message : String(error) });
		}
		process.exitCode = FAILURE_EXIT_CODE;
	}
}

void run();

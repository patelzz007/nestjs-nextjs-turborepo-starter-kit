/**
 * Re-wraps every tenant data key to the CURRENT key-encryption key — run after
 * rotating TENANT_ENCRYPTION_MASTER_KEY (see apps/api/.env.example) and before
 * removing a retired key from TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS.
 *
 * Usage: pnpm --filter @workspace/api db:rewrap-tenant-keys -- --actor-user-id <superadmin user id>
 * Every re-wrapped key gets an organization audit row naming the actor.
 * Command-line entry point only (run through tsx; not part of the API bundle).
 */
import { Logger } from "@nestjs/common";

import { runTenantKeyRewrap } from "./tenant-key-rewrap.command";

const logger: Logger = new Logger("TenantKeyRewrap");

void runTenantKeyRewrap(process.argv.slice(2), (line: string): void => {
	logger.log(line);
}).then((exitCode: number): void => {
	process.exitCode = exitCode;
});

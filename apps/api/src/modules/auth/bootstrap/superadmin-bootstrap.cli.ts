/**
 * One-time creation of the platform's FIRST SuperAdmin, for deployments where the seed must never run.
 *
 * Usage: pnpm --filter @workspace/api admin:bootstrap-superadmin -- --email <email> --full-name <name> [--password-stdin]
 * The password is read from a no-echo prompt (or stdin with --password-stdin) — never argv or env.
 * Command-line entry point only (run through tsx; not part of the API bundle).
 * See docs/technical/operations/superadmin-bootstrap.md.
 */
import { Logger } from "@nestjs/common";

import { runSuperAdminBootstrap } from "./superadmin-bootstrap.run";

const logger: Logger = new Logger("SuperAdminBootstrap");
const EXIT_UNEXPECTED_FAILURE = 70;

try {
	process.exitCode = await runSuperAdminBootstrap(process.argv.slice(2), { stdin: process.stdin, stderr: process.stderr }, (line: string): void => {
		logger.log(line);
	});
} catch (error) {
	logger.error(`The bootstrap failed and changed nothing: ${error instanceof Error ? error.message : "unknown failure"}`);
	process.exitCode = EXIT_UNEXPECTED_FAILURE;
}

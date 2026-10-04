import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
	MIGRATE_DIFF_EXIT_DRIFT,
	MIGRATE_DIFF_EXIT_ERROR,
	MIGRATE_DIFF_EXIT_IN_SYNC,
	MigrationDriftEnvSchema,
	buildMigrateDiffArgs,
	interpretMigrateDiffExitCode,
	type MigrationDriftOutcome,
} from "./migration-drift.js";

/**
 * `pnpm db:check-drift` — fails when `prisma/migrations` does not produce
 * exactly `prisma/schema.prisma`. Needs DATABASE_URL (read by prisma.config.ts)
 * and SHADOW_DATABASE_URL (a dedicated, throwaway database).
 *
 * Exit codes: 0 in sync, 2 drift, 1 configuration or Prisma error.
 */

const apiDir: string = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli: string = createRequire(import.meta.url).resolve("prisma/build/index.js");

function run(): number {
	const env = MigrationDriftEnvSchema.safeParse(process.env);
	if (!env.success) {
		const issues: string = env.error.issues.map((issue): string => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
		console.error(`Migration drift check: invalid environment\n${issues}`);
		return MIGRATE_DIFF_EXIT_ERROR;
	}

	const args: string[] = buildMigrateDiffArgs({
		migrationsDir: resolve(apiDir, "prisma/migrations"),
		schemaFile: resolve(apiDir, "prisma/schema.prisma"),
	});
	const result: SpawnSyncReturns<Buffer> = spawnSync(process.execPath, [prismaCli, ...args], { cwd: apiDir, stdio: "inherit" });
	if (result.error !== undefined) {
		console.error(`Migration drift check: could not start the Prisma CLI: ${result.error.message}`);
		return MIGRATE_DIFF_EXIT_ERROR;
	}

	const outcome: MigrationDriftOutcome = interpretMigrateDiffExitCode(result.status);
	switch (outcome) {
		case "in-sync":
			console.log("No migration drift: prisma/migrations reproduces prisma/schema.prisma exactly.");
			return MIGRATE_DIFF_EXIT_IN_SYNC;
		case "drift":
			console.error(
				"Migration drift detected: the SQL above is what prisma/migrations is missing. Create a forward migration with `pnpm db:migrate:create --name <change>` (never edit an applied migration).",
			);
			return MIGRATE_DIFF_EXIT_DRIFT;
		case "error":
			console.error("Migration drift check failed: `prisma migrate diff` exited with an error (see output above).");
			return MIGRATE_DIFF_EXIT_ERROR;
	}
}

process.exitCode = run();

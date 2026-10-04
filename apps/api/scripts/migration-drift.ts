import { PostgresUrlEnvSchema } from "@workspace/shared";
import { z } from "zod";

/**
 * Pure logic behind `pnpm db:check-drift` (scripts/check-migration-drift.ts).
 *
 * The check replays `prisma/migrations` into a throwaway shadow database and
 * compares the result with `prisma/schema.prisma`. Any difference means a
 * schema edit has no migration, or a migration was edited by hand.
 */

/** PostgreSQL's default port, used when a connection URL omits it. */
const DEFAULT_POSTGRES_PORT = "5432";

/** `prisma migrate diff --exit-code`: the two sources match. */
export const MIGRATE_DIFF_EXIT_IN_SYNC = 0;
/** `prisma migrate diff --exit-code`: the command itself failed. */
export const MIGRATE_DIFF_EXIT_ERROR = 1;
/** `prisma migrate diff --exit-code`: the two sources differ. */
export const MIGRATE_DIFF_EXIT_DRIFT = 2;

export type MigrationDriftOutcome = "in-sync" | "drift" | "error";

/** Identity of a database: two URLs naming the same one must never be used as app DB + shadow DB. */
function databaseIdentity(connectionUrl: string): string {
	const url: URL = new URL(connectionUrl);
	const port: string = url.port.length > 0 ? url.port : DEFAULT_POSTGRES_PORT;
	return `${url.hostname.toLowerCase()}:${port}${decodeURIComponent(url.pathname)}`;
}

export function isSameDatabase(firstUrl: string, secondUrl: string): boolean {
	return databaseIdentity(firstUrl) === databaseIdentity(secondUrl);
}

/**
 * Prisma drops every object in the shadow database on each run, so it must be
 * a dedicated, empty database — never the application database.
 */
export const MigrationDriftEnvSchema = z
	.object({
		DATABASE_URL: PostgresUrlEnvSchema,
		SHADOW_DATABASE_URL: PostgresUrlEnvSchema,
	})
	.refine((env: { DATABASE_URL: string; SHADOW_DATABASE_URL: string }): boolean => !isSameDatabase(env.DATABASE_URL, env.SHADOW_DATABASE_URL), {
		message: "SHADOW_DATABASE_URL must name a separate, throwaway database: Prisma wipes it on every run",
		path: ["SHADOW_DATABASE_URL"],
		// Compare only two valid URLs: zod still runs object refinements after a field failed.
		when: (payload: z.core.ParsePayload): boolean => payload.issues.length === 0,
	});

export type MigrationDriftEnv = z.infer<typeof MigrationDriftEnvSchema>;

export interface MigrationDriftPaths {
	readonly migrationsDir: string;
	readonly schemaFile: string;
}

/** Arguments for the Prisma CLI: migration history (replayed in the shadow DB) → schema, exit code 2 on drift. */
export function buildMigrateDiffArgs(paths: MigrationDriftPaths): string[] {
	return ["migrate", "diff", "--from-migrations", paths.migrationsDir, "--to-schema", paths.schemaFile, "--script", "--exit-code"];
}

/** `status` is null when the child was killed by a signal, which counts as an error. */
export function interpretMigrateDiffExitCode(status: number | null): MigrationDriftOutcome {
	if (status === MIGRATE_DIFF_EXIT_IN_SYNC) {
		return "in-sync";
	}

	if (status === MIGRATE_DIFF_EXIT_DRIFT) {
		return "drift";
	}

	return "error";
}

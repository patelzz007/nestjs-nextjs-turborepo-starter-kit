import { describe, expect, it } from "vitest";

import {
	MIGRATE_DIFF_EXIT_DRIFT,
	MIGRATE_DIFF_EXIT_ERROR,
	MIGRATE_DIFF_EXIT_IN_SYNC,
	MigrationDriftEnvSchema,
	buildMigrateDiffArgs,
	interpretMigrateDiffExitCode,
	isSameDatabase,
} from "./migration-drift.js";

const APP_DB = "postgresql://postgres:postgres@localhost:5432/app?schema=public";
const SHADOW_DB = "postgresql://postgres:postgres@localhost:5432/app_shadow?schema=public";
/** 128 + SIGKILL(9): what a shell reports for an OOM-killed child. */
const UNEXPECTED_EXIT_STATUS = 137;

describe("migration drift check", () => {
	describe("buildMigrateDiffArgs", () => {
		it("diffs the migration history against the schema and signals drift through the exit code", () => {
			expect(buildMigrateDiffArgs({ migrationsDir: "/api/prisma/migrations", schemaFile: "/api/prisma/schema.prisma" })).toEqual([
				"migrate",
				"diff",
				"--from-migrations",
				"/api/prisma/migrations",
				"--to-schema",
				"/api/prisma/schema.prisma",
				"--script",
				"--exit-code",
			]);
		});
	});

	describe("interpretMigrateDiffExitCode", () => {
		it("maps Prisma's --exit-code contract: 0 in sync, 2 drift, 1 error", () => {
			expect(interpretMigrateDiffExitCode(MIGRATE_DIFF_EXIT_IN_SYNC)).toBe("in-sync");
			expect(interpretMigrateDiffExitCode(MIGRATE_DIFF_EXIT_DRIFT)).toBe("drift");
			expect(interpretMigrateDiffExitCode(MIGRATE_DIFF_EXIT_ERROR)).toBe("error");
		});

		it("treats a signal-killed child (null status) and unknown codes as errors, never as in sync", () => {
			expect(interpretMigrateDiffExitCode(null)).toBe("error");
			expect(interpretMigrateDiffExitCode(UNEXPECTED_EXIT_STATUS)).toBe("error");
		});
	});

	describe("isSameDatabase", () => {
		it("ignores credentials, query parameters, host case and an omitted default port", () => {
			expect(isSameDatabase("postgresql://a:b@LOCALHOST/app?schema=public", "postgres://c:d@localhost:5432/app")).toBe(true);
		});

		it("distinguishes databases by name, host or port", () => {
			expect(isSameDatabase(APP_DB, SHADOW_DB)).toBe(false);
			expect(isSameDatabase(APP_DB, "postgresql://postgres:postgres@db.internal:5432/app")).toBe(false);
			expect(isSameDatabase(APP_DB, "postgresql://postgres:postgres@localhost:5433/app")).toBe(false);
		});
	});

	describe("MigrationDriftEnvSchema", () => {
		it("accepts a separate shadow database", () => {
			expect(MigrationDriftEnvSchema.safeParse({ DATABASE_URL: APP_DB, SHADOW_DATABASE_URL: SHADOW_DB }).success).toBe(true);
		});

		it("requires SHADOW_DATABASE_URL", () => {
			const result = MigrationDriftEnvSchema.safeParse({ DATABASE_URL: APP_DB });
			expect(result.success).toBe(false);
			expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["SHADOW_DATABASE_URL"]);
		});

		it("reports an empty SHADOW_DATABASE_URL as an issue instead of throwing", () => {
			const result = MigrationDriftEnvSchema.safeParse({ DATABASE_URL: APP_DB, SHADOW_DATABASE_URL: "" });
			expect(result.success).toBe(false);
			expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["SHADOW_DATABASE_URL"]);
		});

		it("rejects a non-postgres shadow URL", () => {
			expect(MigrationDriftEnvSchema.safeParse({ DATABASE_URL: APP_DB, SHADOW_DATABASE_URL: "mysql://localhost/app_shadow" }).success).toBe(false);
		});

		it("refuses to use the application database as the shadow, because Prisma wipes the shadow on every run", () => {
			const result = MigrationDriftEnvSchema.safeParse({ DATABASE_URL: APP_DB, SHADOW_DATABASE_URL: "postgres://other:creds@localhost/app" });
			expect(result.success).toBe(false);
			expect(result.error?.issues[0]?.message).toMatch(/separate, throwaway database/);
		});
	});
});

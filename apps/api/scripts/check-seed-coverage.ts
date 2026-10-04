import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Prisma } from "@prisma/client";
import { PostgresUrlEnvSchema } from "@workspace/shared";
import { Pool } from "pg";
import { z } from "zod";

import { SEED_COVERAGE_EXEMPTIONS } from "../prisma/seed/coverage-exemptions.js";
import { BEGIN_READ_ONLY_AUDIT_SQL, parseSeedCoverageConnection, PgSeedCoverageCatalog } from "./seed-coverage-catalog.js";
import {
	formatSeedCoverageReport,
	isCovered,
	listSchemaFileModelNames,
	SeedCoverageAuditor,
	schemaTablesFromDmmf,
	type SeedCoverageReport,
	type SeedCoverageSchema,
} from "./seed-coverage.js";

/**
 * `pnpm db:check-seed-coverage` — run right after `pnpm db:seed`. Fails when a
 * table in `schema.prisma` has no rows, or a nullable column is NULL in every
 * row, unless `prisma/seed/coverage-exemptions.ts` lists it with a reason.
 *
 * Connects with DATABASE_URL (the migration/owner login — the same one
 * `db:apply-security` and the seed use), inside a READ ONLY transaction with
 * `row_security = off`, so it never writes and never sees an RLS-filtered view.
 *
 * Exit codes: 0 covered, 1 gaps found or the check could not run.
 */

const EXIT_COVERED = 0;
const EXIT_FAILED = 1;

const schemaFile: string = resolve(dirname(fileURLToPath(import.meta.url)), "../prisma/schema.prisma");

const EnvSchema = z.object({ DATABASE_URL: PostgresUrlEnvSchema });

function readSchema(): SeedCoverageSchema {
	return {
		tables: schemaTablesFromDmmf(Prisma.dmmf.datamodel.models),
		schemaFileModelNames: listSchemaFileModelNames(readFileSync(schemaFile, "utf8")),
	};
}

async function auditDatabase(databaseUrl: string, schema: SeedCoverageSchema): Promise<SeedCoverageReport> {
	const connection = parseSeedCoverageConnection(databaseUrl);
	const pool = new Pool({ connectionString: connection.connectionString, max: 1 });
	try {
		const client = await pool.connect();
		try {
			for (const statement of BEGIN_READ_ONLY_AUDIT_SQL) {
				await client.query(statement);
			}
			const auditor = new SeedCoverageAuditor(new PgSeedCoverageCatalog(client, connection.schemaName), schema, SEED_COVERAGE_EXEMPTIONS);
			return await auditor.audit();
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	} finally {
		await pool.end();
	}
}

async function run(): Promise<number> {
	const env = EnvSchema.safeParse(process.env);
	if (!env.success) {
		console.error(`Seed coverage check: DATABASE_URL is missing or invalid (${env.error.issues.map((issue) => issue.message).join("; ")})`);
		return EXIT_FAILED;
	}

	try {
		const report = await auditDatabase(env.data.DATABASE_URL, readSchema());
		const output = formatSeedCoverageReport(report);
		if (isCovered(report)) {
			console.log(output);
			return EXIT_COVERED;
		}
		console.error(output);
		return EXIT_FAILED;
	} catch (error: unknown) {
		console.error(`Seed coverage check failed: ${error instanceof Error ? error.message : String(error)}`);
		return EXIT_FAILED;
	}
}

process.exitCode = await run();

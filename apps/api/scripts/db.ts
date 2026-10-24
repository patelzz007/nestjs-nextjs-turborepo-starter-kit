// ============================================
// scripts/db.ts — the database tooling, one command each (run through the `db:*` package scripts)
// ============================================
//   schema [--check]                    pnpm db:schema — write (or verify) the base model's managed blocks
//   apply-security                      pnpm db:apply-security — RLS, grants, capture + audit triggers
//   check-rls-manifest                  pnpm db:check-rls-manifest — schema ⇄ manifest ⇄ RLS SQL drift
//   generate-system-operation-scopes    pnpm db:generate-system-operation-scopes — render the scopes SQL
//   check-drift                         pnpm db:check-drift — prisma/migrations reproduce schema.prisma
//   check-seed-coverage                 pnpm db:check-seed-coverage — every table and column seeded

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Prisma as PrismaNamespace } from "@prisma/client";
import { PostgresUrlEnvSchema } from "@workspace/shared";
import { Pool } from "pg";
import { z } from "zod";

import { applyBaseModel } from "../prisma/engine/schema-engine";
import { buildRlsApplyPlan, stripSqlComments } from "../prisma/rls/apply-plan";
import { applyRowLevelSecurity } from "../prisma/rls/apply";
import {
	collectRlsEnabledTableNames,
	computeRlsManifestDrift,
	listAllManifestTables,
	parsePrismaSchemaModels,
	type RlsManifestDriftReport,
} from "../prisma/rls/manifest-index";
import { buildSystemOperationScopesSql, SYSTEM_OPERATION_SCOPES_SQL_PATH } from "../prisma/rls/system-operation-scopes";
import { findHandWrittenAppRuntimeRevokes, findUnknownWithheldPrivilegeTables, listWithheldPrivileges } from "../prisma/rls/withheld-privileges";
import { SEED_COVERAGE_EXEMPTIONS } from "../prisma/seed/coverage-exemptions";
import { EXIT_FAILED, EXIT_OK, PROCESS_OUTPUT, runCli, type CliCommand } from "./lib/cli";
import {
	buildMigrateDiffArgs,
	MIGRATE_DIFF_EXIT_DRIFT,
	MIGRATE_DIFF_EXIT_ERROR,
	MIGRATE_DIFF_EXIT_IN_SYNC,
	interpretMigrateDiffExitCode,
	MigrationDriftEnvSchema,
} from "./lib/migration-drift";
import {
	formatSeedCoverageReport,
	isCovered,
	listSchemaFileModelNames,
	schemaTablesFromDmmf,
	SeedCoverageAuditor,
	type SeedCoverageReport,
	type SeedCoverageSchema,
} from "./lib/seed-coverage";
import { BEGIN_READ_ONLY_AUDIT_SQL, parseSeedCoverageConnection, PgSeedCoverageCatalog } from "./lib/seed-coverage-catalog";

const { out, err } = PROCESS_OUTPUT;

// The generated Prisma client is loaded only by the commands that read it (`import()` inside them):
// `schema` runs before `prisma generate` in `db:generate`, so it must work while no client exists yet
// (a fresh install, or one that re-created @prisma/client in a new store folder).

/** The generated client's `Prisma` namespace (model metadata). */
async function loadPrisma(): Promise<typeof PrismaNamespace> {
	const { Prisma } = await import("@prisma/client");
	return Prisma;
}
const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prismaDir = resolve(apiDir, "prisma");
const schemaFile = resolve(prismaDir, "schema.prisma");

// ── schema ────────────────────────────────────────────────────────────────

/** The schema as `prisma format` writes it, so the file and a fresh run compare byte for byte. */
function formattedSchema(schema: string): string {
	const scratch = mkdtempSync(join(tmpdir(), "schema-engine-"));
	try {
		const file = join(scratch, "schema.prisma");
		writeFileSync(file, schema);
		execFileSync(join(apiDir, "node_modules", ".bin", "prisma"), ["format", "--schema", file], { cwd: apiDir, stdio: "ignore" });
		return readFileSync(file, "utf8");
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}

/**
 * Writes the base model's fields into every `/// @extends BaseModel` model of prisma/schema.prisma (the
 * managed blocks; prisma/engine/schema-engine.ts) and formats the file. `--check` only verifies the file
 * is already that way. The db:* scripts run it before Prisma, so a new model needs only its own fields.
 */
function schema(args: readonly string[]): number {
	const current = readFileSync(schemaFile, "utf8");
	const applied = formattedSchema(applyBaseModel(current));
	if (applied === current) {
		out("prisma/schema.prisma: every model carries the current base model.");
		return EXIT_OK;
	}
	if (args.includes("--check")) {
		err("prisma/schema.prisma is out of date with its base model — run `pnpm --filter @workspace/api db:schema`.");
		return EXIT_FAILED;
	}
	writeFileSync(schemaFile, applied);
	out("Wrote the base model into every model of prisma/schema.prisma.");
	return EXIT_OK;
}

// ── apply-security ────────────────────────────────────────────────────────

async function applySecurity(): Promise<number> {
	await applyRowLevelSecurity(out);
	return EXIT_OK;
}

// ── check-rls-manifest ────────────────────────────────────────────────────

/** `rls.sql` followed by every `prisma/rls/*.sql` fragment, in name order. */
function readRlsSqlBundle(): string {
	const bundle = resolve(prismaDir, "rls.sql");
	const fragmentsDir = resolve(prismaDir, "rls");
	const fragments = existsSync(fragmentsDir)
		? readdirSync(fragmentsDir)
				.filter((name: string): boolean => name.endsWith(".sql"))
				.sort((left: string, right: string): number => left.localeCompare(right))
				.map((name: string): string => resolve(fragmentsDir, name))
		: [];
	return [...(existsSync(bundle) ? [bundle] : []), ...fragments].map((file: string): string => `${readFileSync(file, "utf8")}\n`).join("");
}

function formatSection(title: string, items: readonly string[]): string {
	return items.length === 0 ? "" : [`${title}:`, ...items.map((item: string): string => `  - ${item}`), ""].join("\n");
}

function hasManifestIssues(report: RlsManifestDriftReport): boolean {
	return [report.missingFromManifest, report.unknownManifestTables, report.tenantModelsMissingManifest, report.locationProfileMismatch, report.manifestNotInRlsSql].some(
		(items: readonly string[]): boolean => items.length > 0,
	);
}

/** Fails when the Prisma models, the RLS manifest (prisma/rls/manifest-index.ts) and the RLS SQL disagree. */
function checkRlsManifest(): number {
	// Fails fast on apply-order / helper-dependency drift before the table scan.
	const applyPlan = buildRlsApplyPlan(apiDir);
	const rlsSql = readRlsSqlBundle();
	const prismaModels = parsePrismaSchemaModels(readFileSync(schemaFile, "utf8"));
	const manifestTables = listAllManifestTables();
	const rlsEnabledTables = collectRlsEnabledTableNames(rlsSql);
	const report = computeRlsManifestDrift({ prismaModels, manifestTables, rlsEnabledTables });
	const withheld = listWithheldPrivileges();
	const unknownWithheldTables = findUnknownWithheldPrivilegeTables(withheld, new Set(prismaModels.map((model) => model.tableName)));
	const handWrittenRevokes = findHandWrittenAppRuntimeRevokes(stripSqlComments(rlsSql));

	out("RLS manifest drift check");
	out(`  Apply plan: ${String(applyPlan.length)} files in RLS_APPLY_ORDER (helper dependencies OK)`);
	out(`  Prisma models: ${String(prismaModels.length)}`);
	out(`  Manifest tables: ${String(manifestTables.length)}`);
	out(`  RLS-enabled tables (sql scan): ${String(rlsEnabledTables.size)}`);
	out(`  Tables with withheld app_runtime privileges: ${String(withheld.length)}`);
	out("");

	const body = [
		formatSection("Tables in Prisma but missing from manifest", report.missingFromManifest),
		formatSection("Manifest entries with no Prisma model", report.unknownManifestTables),
		formatSection("Models with tenant_id missing from manifest", report.tenantModelsMissingManifest),
		formatSection("Location profile mismatches", report.locationProfileMismatch),
		formatSection("Manifest tables not found in RLS SQL enable list", report.manifestNotInRlsSql),
		formatSection("Withheld-privilege entries with no Prisma model (prisma/rls/withheld-privileges.ts)", unknownWithheldTables),
		formatSection("Hand-written REVOKE … FROM app_runtime (undone by the blanket grant — declare the table in withheld-privileges.ts)", handWrittenRevokes),
	]
		.filter((section: string): boolean => section.length > 0)
		.join("\n");
	if (body.length > 0) {
		out(body);
	}
	if (hasManifestIssues(report) || unknownWithheldTables.length > 0 || handWrittenRevokes.length > 0) {
		err("RLS manifest drift detected — update manifest-index.ts and prisma/rls*.sql");
		return EXIT_FAILED;
	}
	out("No RLS manifest drift detected.");
	return EXIT_OK;
}

// ── generate-system-operation-scopes ──────────────────────────────────────

/** Renders prisma/rls/00-system-operation-scopes.sql from the registry; run after changing an operation's `scope`. */
async function generateSystemOperationScopes(): Promise<number> {
	const { SYSTEM_OPERATIONS } = await import("../src/prisma/system-operation.registry");
	writeFileSync(resolve(apiDir, SYSTEM_OPERATION_SCOPES_SQL_PATH), buildSystemOperationScopesSql(SYSTEM_OPERATIONS, new Set(listAllManifestTables())));
	out(`Wrote ${SYSTEM_OPERATION_SCOPES_SQL_PATH}`);
	return EXIT_OK;
}

// ── check-drift ───────────────────────────────────────────────────────────

/**
 * Fails when prisma/migrations does not produce exactly prisma/schema.prisma. Needs DATABASE_URL (read by
 * prisma.config.ts) and SHADOW_DATABASE_URL (a dedicated, throwaway database). Exit 0 in sync, 2 drift,
 * 1 configuration or Prisma error.
 */
function checkDrift(): number {
	const env = MigrationDriftEnvSchema.safeParse(process.env);
	if (!env.success) {
		err(`Migration drift check: invalid environment\n${env.error.issues.map((issue): string => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n")}`);
		return MIGRATE_DIFF_EXIT_ERROR;
	}
	const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
	const args = buildMigrateDiffArgs({ migrationsDir: resolve(prismaDir, "migrations"), schemaFile });
	const result = spawnSync(process.execPath, [prismaCli, ...args], { cwd: apiDir, stdio: "inherit" });
	if (result.error !== undefined) {
		err(`Migration drift check: could not start the Prisma CLI: ${result.error.message}`);
		return MIGRATE_DIFF_EXIT_ERROR;
	}
	switch (interpretMigrateDiffExitCode(result.status)) {
		case "in-sync":
			out("No migration drift: prisma/migrations reproduces prisma/schema.prisma exactly.");
			return MIGRATE_DIFF_EXIT_IN_SYNC;
		case "drift":
			err(
				"Migration drift detected: the SQL above is what prisma/migrations is missing. Create a forward migration with `pnpm db:migrate:create --name <change>` (never edit an applied migration).",
			);
			return MIGRATE_DIFF_EXIT_DRIFT;
		case "error":
			err("Migration drift check failed: `prisma migrate diff` exited with an error (see output above).");
			return MIGRATE_DIFF_EXIT_ERROR;
	}
}

// ── check-seed-coverage ───────────────────────────────────────────────────

const SeedCoverageEnvSchema = z.object({ DATABASE_URL: PostgresUrlEnvSchema });

async function auditSeedCoverage(databaseUrl: string, schemaTables: SeedCoverageSchema): Promise<SeedCoverageReport> {
	const connection = parseSeedCoverageConnection(databaseUrl);
	const pool = new Pool({ connectionString: connection.connectionString, max: 1 });
	try {
		const client = await pool.connect();
		try {
			for (const statement of BEGIN_READ_ONLY_AUDIT_SQL) {
				await client.query(statement);
			}
			return await new SeedCoverageAuditor(new PgSeedCoverageCatalog(client, connection.schemaName), schemaTables, SEED_COVERAGE_EXEMPTIONS).audit();
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	} finally {
		await pool.end();
	}
}

/**
 * Run right after `pnpm db:seed`: fails when a table has no rows, or a nullable column is NULL in every
 * row, unless prisma/seed/coverage-exemptions.ts lists it with a reason. Reads with DATABASE_URL inside a
 * READ ONLY transaction with `row_security = off`, so it never writes and never sees an RLS-filtered view.
 */
async function checkSeedCoverage(): Promise<number> {
	const env = SeedCoverageEnvSchema.safeParse(process.env);
	if (!env.success) {
		err(`Seed coverage check: DATABASE_URL is missing or invalid (${env.error.issues.map((issue): string => issue.message).join("; ")})`);
		return EXIT_FAILED;
	}
	const report = await auditSeedCoverage(env.data.DATABASE_URL, {
		tables: schemaTablesFromDmmf((await loadPrisma()).dmmf.datamodel.models),
		schemaFileModelNames: listSchemaFileModelNames(readFileSync(schemaFile, "utf8")),
	});
	const text = formatSeedCoverageReport(report);
	if (isCovered(report)) {
		out(text);
		return EXIT_OK;
	}
	err(text);
	return EXIT_FAILED;
}

// ── entry ─────────────────────────────────────────────────────────────────

const DB_COMMANDS: ReadonlyMap<string, CliCommand> = new Map<string, CliCommand>([
	["schema", { summary: "Write the base model into every model of prisma/schema.prisma (--check: verify only)", run: schema }],
	["apply-security", { summary: "Apply RLS, grants, withheld privileges, data-change capture and row audit triggers", run: applySecurity }],
	["check-rls-manifest", { summary: "Fail when the Prisma models, the RLS manifest and the RLS SQL disagree", run: checkRlsManifest }],
	["generate-system-operation-scopes", { summary: "Render prisma/rls/00-system-operation-scopes.sql from the registry", run: generateSystemOperationScopes }],
	["check-drift", { summary: "Fail when prisma/migrations does not reproduce prisma/schema.prisma", run: checkDrift }],
	["check-seed-coverage", { summary: "Fail when a table or nullable column of the seeded database is empty", run: checkSeedCoverage }],
]);

process.exitCode = await runCli("db", DB_COMMANDS, process.argv.slice(2));

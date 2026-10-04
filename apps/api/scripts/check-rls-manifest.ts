import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
	collectRlsEnabledTableNames,
	computeRlsManifestDrift,
	listAllManifestTables,
	parsePrismaSchemaModels,
	type RlsManifestDriftReport,
} from "../prisma/rls/manifest-index.js";
import { findHandWrittenAppRuntimeRevokes, findUnknownWithheldPrivilegeTables, listWithheldPrivileges } from "../prisma/rls/withheld-privileges.js";
import { buildRlsApplyPlan, stripSqlComments } from "./rls-apply-plan.js";

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prismaDir = resolve(apiDir, "prisma");
const schemaFile = resolve(prismaDir, "schema.prisma");
const rlsBundleFile = resolve(prismaDir, "rls.sql");
const rlsFragmentsDir = resolve(prismaDir, "rls");

function readRlsSqlBundle(): string {
	let content = "";

	if (existsSync(rlsBundleFile)) {
		content += readFileSync(rlsBundleFile, "utf8");
		content += "\n";
	}

	if (existsSync(rlsFragmentsDir)) {
		const fragments = readdirSync(rlsFragmentsDir)
			.filter((name: string) => name.endsWith(".sql"))
			.sort((a: string, b: string) => a.localeCompare(b));

		for (const name of fragments) {
			content += readFileSync(resolve(rlsFragmentsDir, name), "utf8");
			content += "\n";
		}
	}

	return content;
}

function formatSection(title: string, items: readonly string[]): string {
	if (items.length === 0) {
		return "";
	}

	return [`${title}:`, ...items.map((item) => `  - ${item}`), ""].join("\n");
}

function reportHasIssues(report: RlsManifestDriftReport): boolean {
	return (
		report.missingFromManifest.length > 0 ||
		report.unknownManifestTables.length > 0 ||
		report.orgModelsMissingManifest.length > 0 ||
		report.locationProfileMismatch.length > 0 ||
		report.manifestNotInRlsSql.length > 0
	);
}

function run(): void {
	// Fail fast on apply-order / helper-dependency drift before the table scan.
	const applyPlan = buildRlsApplyPlan(apiDir);

	if (!existsSync(schemaFile)) {
		throw new Error(`Prisma schema not found: ${schemaFile}`);
	}

	const schemaContent = readFileSync(schemaFile, "utf8");
	const rlsSqlContent = readRlsSqlBundle();

	const prismaModels = parsePrismaSchemaModels(schemaContent);
	const manifestTables = listAllManifestTables();
	const rlsEnabledTables = collectRlsEnabledTableNames(rlsSqlContent);

	const report = computeRlsManifestDrift({
		prismaModels,
		manifestTables,
		rlsEnabledTables,
	});
	const withheld = listWithheldPrivileges();
	const unknownWithheldTables: string[] = findUnknownWithheldPrivilegeTables(withheld, new Set(prismaModels.map((model) => model.tableName)));
	const handWrittenRevokes: string[] = findHandWrittenAppRuntimeRevokes(stripSqlComments(rlsSqlContent));

	console.log("RLS manifest drift check");
	console.log(`  Apply plan: ${String(applyPlan.length)} files in RLS_APPLY_ORDER (helper dependencies OK)`);
	console.log(`  Prisma models: ${String(prismaModels.length)}`);
	console.log(`  Manifest tables: ${String(manifestTables.length)}`);
	console.log(`  RLS-enabled tables (sql scan): ${String(rlsEnabledTables.size)}`);
	console.log(`  Tables with withheld app_runtime privileges: ${String(withheld.length)}`);
	console.log("");

	const body = [
		formatSection("Tables in Prisma but missing from manifest", report.missingFromManifest),
		formatSection("Manifest entries with no Prisma model", report.unknownManifestTables),
		formatSection("Models with organization_id missing from manifest", report.orgModelsMissingManifest),
		formatSection("Location profile mismatches", report.locationProfileMismatch),
		formatSection("Manifest tables not found in RLS SQL enable list", report.manifestNotInRlsSql),
		formatSection("Withheld-privilege entries with no Prisma model (prisma/rls/withheld-privileges.ts)", unknownWithheldTables),
		formatSection("Hand-written REVOKE … FROM app_runtime (undone by the blanket grant — declare the table in withheld-privileges.ts)", handWrittenRevokes),
	]
		.filter((section) => section.length > 0)
		.join("\n");

	if (body.length > 0) {
		console.log(body);
	}

	if (reportHasIssues(report) || unknownWithheldTables.length > 0 || handWrittenRevokes.length > 0) {
		throw new Error("RLS manifest drift detected — update manifest-index.ts and prisma/rls*.sql");
	}

	console.log("No RLS manifest drift detected.");
}

try {
	run();
} catch (error) {
	console.error("");

	if (error instanceof Error) {
		console.error(`Error: ${error.message}`);
	} else {
		console.error(error);
	}

	process.exit(1);
}

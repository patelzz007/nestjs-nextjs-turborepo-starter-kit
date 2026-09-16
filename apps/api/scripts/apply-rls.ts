import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prismaDir = resolve(apiDir, "prisma");
const rlsBundleFile = resolve(prismaDir, "rls.sql");
const rlsFragmentsDir = resolve(prismaDir, "rls");
const envFile = resolve(apiDir, ".env");

function getDatabaseUrl(): string {
	const fromEnv = process.env.DATABASE_URL?.trim();
	if (fromEnv !== undefined && fromEnv.length > 0) {
		return fromEnv;
	}

	if (!existsSync(envFile)) {
		throw new Error(`DATABASE_URL is not set and .env was not found at ${envFile}`);
	}

	const envContent = readFileSync(envFile, "utf8");

	const databaseUrlLine = envContent.split(/\r?\n/).find((line: string) => line.trim().startsWith("DATABASE_URL="));

	if (databaseUrlLine === undefined) {
		throw new Error(`DATABASE_URL was not found inside ${envFile}`);
	}

	let value = databaseUrlLine.slice(databaseUrlLine.indexOf("=") + 1).trim();

	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		value = value.slice(1, -1);
	}

	return value;
}

function stripPrismaQueryParams(databaseUrl: string): string {
	const questionMarkIndex = databaseUrl.indexOf("?");

	if (questionMarkIndex === -1) {
		return databaseUrl;
	}

	return databaseUrl.slice(0, questionMarkIndex);
}

function listRlsSqlFiles(): string[] {
	const fragments: string[] = [];

	if (existsSync(rlsFragmentsDir)) {
		const sorted = readdirSync(rlsFragmentsDir)
			.filter((name: string) => name.endsWith(".sql"))
			.sort((a: string, b: string) => a.localeCompare(b))
			.map((name: string) => resolve(rlsFragmentsDir, name));
		fragments.push(...sorted);
	}

	const aclFragment = fragments.find((path: string) => path.endsWith("01-acl-location-access.sql"));
	const grantsFragment = fragments.find((path: string) => path.endsWith("99-app-runtime-grants.sql"));
	const otherFragments = fragments.filter((path: string) => path !== aclFragment && path !== grantsFragment);

	const files: string[] = [];

	if (aclFragment !== undefined) {
		files.push(aclFragment);
	}

	if (existsSync(rlsBundleFile)) {
		files.push(rlsBundleFile);
	}

	files.push(...otherFragments);

	if (grantsFragment !== undefined) {
		files.push(grantsFragment);
	}

	if (files.length === 0) {
		throw new Error(`No RLS SQL found. Expected ${rlsBundleFile} and/or ${rlsFragmentsDir}/*.sql`);
	}

	return files;
}

async function runSqlFile(pool: Pool, sqlFile: string): Promise<void> {
	const sql = readFileSync(sqlFile, "utf8");
	await pool.query(sql);
}

/**
 * Apply `prisma/rls.sql` and `prisma/rls/*.sql` via the Node `pg` driver.
 * No local `psql` binary required — only a reachable `DATABASE_URL` (Docker Postgres on localhost is fine).
 */
export async function applyRowLevelSecurity(): Promise<void> {
	const databaseUrl = stripPrismaQueryParams(getDatabaseUrl());
	const sqlFiles = listRlsSqlFiles();
	const pool = new Pool({ connectionString: databaseUrl });

	console.log("Applying Row-Level Security (idempotent) ...");

	try {
		for (const sqlFile of sqlFiles) {
			const relative = sqlFile.startsWith(apiDir) ? sqlFile.slice(apiDir.length + 1) : sqlFile;
			console.log(`  → ${relative}`);
			await runSqlFile(pool, sqlFile);
		}

		console.log("RLS applied successfully.");
	} finally {
		await pool.end();
	}
}

function isApplyRlsCliEntry(): boolean {
	const entry = process.argv[1];
	if (entry.length === 0) {
		return false;
	}
	return resolve(entry) === fileURLToPath(import.meta.url);
}

if (isApplyRlsCliEntry()) {
	void applyRowLevelSecurity().catch((error: unknown) => {
		console.error("");

		if (error instanceof Error) {
			console.error(`Error: ${error.message}`);
		} else {
			console.error(error);
		}

		process.exit(1);
	});
}

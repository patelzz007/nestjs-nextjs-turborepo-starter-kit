import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function getNodeErrorCode(error: Error): string | undefined {
	if (!Object.hasOwn(error, "code")) {
		return undefined;
	}

	const descriptor = Object.getOwnPropertyDescriptor(error, "code");
	const codeValue = descriptor?.value;

	if (codeValue === undefined || codeValue === null) {
		return undefined;
	}

	if (typeof codeValue === "string") {
		return codeValue;
	}

	if (typeof codeValue === "number") {
		return String(codeValue);
	}

	return undefined;
}

function listRlsSqlFiles(): string[] {
	const files: string[] = [];

	if (existsSync(rlsBundleFile)) {
		files.push(rlsBundleFile);
	}

	if (existsSync(rlsFragmentsDir)) {
		const fragments = readdirSync(rlsFragmentsDir)
			.filter((name: string) => name.endsWith(".sql"))
			.sort((a: string, b: string) => a.localeCompare(b))
			.map((name: string) => resolve(rlsFragmentsDir, name));

		files.push(...fragments);
	}

	if (files.length === 0) {
		throw new Error(`No RLS SQL found. Expected ${rlsBundleFile} and/or ${rlsFragmentsDir}/*.sql`);
	}

	return files;
}

function runPsql(databaseUrl: string, sqlFile: string): void {
	const command = process.platform === "win32" ? "psql.exe" : "psql";

	const result = spawnSync(command, [databaseUrl, "-f", sqlFile], {
		stdio: "inherit",
		shell: false,
	});

	if (result.error !== undefined) {
		const code = getNodeErrorCode(result.error);
		if (code === "ENOENT") {
			throw new Error(["psql was not found.", "", "Install PostgreSQL client tools and ensure psql is on PATH."].join("\n"));
		}

		throw result.error;
	}

	if (result.status !== 0) {
		throw new Error(`psql exited with code ${String(result.status ?? "unknown")} while applying ${sqlFile}`);
	}
}

function run(): void {
	const databaseUrl = stripPrismaQueryParams(getDatabaseUrl());
	const sqlFiles = listRlsSqlFiles();

	console.log("Applying Row-Level Security (idempotent) ...");

	for (const sqlFile of sqlFiles) {
		const relative = sqlFile.startsWith(apiDir) ? sqlFile.slice(apiDir.length + 1) : sqlFile;
		console.log(`  → ${relative}`);
		runPsql(databaseUrl, sqlFile);
	}

	console.log("RLS applied successfully.");
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

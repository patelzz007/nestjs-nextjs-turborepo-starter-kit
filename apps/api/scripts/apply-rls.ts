import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const apiDir = resolve(import.meta.dirname, "..");
const rlsFile = resolve(apiDir, "prisma", "rls.sql");
const envFile = resolve(apiDir, ".env");

function getDatabaseUrl(): string {
	if (process.env.DATABASE_URL?.trim()) {
		return process.env.DATABASE_URL.trim();
	}

	if (!existsSync(envFile)) {
		throw new Error(`DATABASE_URL is not set and .env was not found at ${envFile}`);
	}

	const envContent = readFileSync(envFile, "utf8");

	const databaseUrlLine = envContent.split(/\r?\n/).find((line) => line.trim().startsWith("DATABASE_URL="));

	if (!databaseUrlLine) {
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

function isErrnoException(error: Error): error is NodeJS.ErrnoException {
	return "code" in error;
}

function run(): void {
	if (!existsSync(rlsFile)) {
		throw new Error(`rls.sql not found at ${rlsFile}`);
	}

	const databaseUrl = stripPrismaQueryParams(getDatabaseUrl());

	console.log("Applying RLS from rls.sql ...");

	const command = process.platform === "win32" ? "psql.exe" : "psql";

	const result = spawnSync(command, [databaseUrl, "-f", rlsFile], {
		stdio: "inherit",
		shell: false,
	});

	if (result.error) {
		if (isErrnoException(result.error) && result.error.code === "ENOENT") {
			throw new Error(
				[
					"psql was not found.",
					"",
					"Make sure PostgreSQL command-line tools are installed and psql is available in PATH.",
					"",
					"Windows example:",
					"C:\\Program Files\\PostgreSQL\\17\\bin",
				].join("\n"),
			);
		}

		throw result.error;
	}

	if (result.status !== 0) {
		throw new Error(`psql exited with code ${String(result.status ?? "unknown")}`);
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

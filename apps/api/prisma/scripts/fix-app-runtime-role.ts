#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error("❌ DATABASE_URL environment variable is not set");
		process.exit(1);
	}

	const pool = new Pool({ connectionString: databaseUrl });

	try {
		console.log("🔧 Fixing app_runtime role grants...");

		const sqlPath = resolve(import.meta.dirname, "fix-app-runtime-role.sql");
		const sql = readFileSync(sqlPath, "utf-8");

		await pool.query(sql);

		console.log("✅ app_runtime role grants fixed successfully!");
	} catch (error) {
		console.error("❌ Failed to fix app_runtime role:", error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});

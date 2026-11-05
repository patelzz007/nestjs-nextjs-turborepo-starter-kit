import { spawn } from "node:child_process";
import type { Readable } from "node:stream";

import { Prisma } from "@prisma/client";
import { Client } from "pg";
import { z } from "zod";

import type { RestoreDrillChecks, RestoreDrillPort } from "../../application/ports/restore-drill.port";
import { pgEnvironment } from "./pg-dump.adapter";

const RESTORE_ARGS: readonly string[] = ["--no-owner", "--no-privileges", "--exit-on-error"];
const CountSchema = z.object({ count: z.string() });
const MigrationSchema = z.object({ migration_name: z.string() });
const RlsRowSchema = z.object({ relname: z.string(), relrowsecurity: z.boolean(), relforcerowsecurity: z.boolean() });
/** How much of `pg_restore`'s error output a failure line keeps. */
const STDERR_EXCERPT_LENGTH = 400;

/**
 * Every application table (one per Prisma model). Each is also row-level secured: the RLS manifest lists every
 * model in exactly one profile (`prisma/rls/__tests__/manifest-index.spec.ts`), so this one list is both checks'
 * subject, and the built API never reaches into the `prisma/` tooling for it.
 */
const EXPECTED_TABLES: readonly string[] = Object.values(Prisma.ModelName);

/** A throwaway database name: never one that exists, never the live one. */
export function restoreDrillDatabaseName(at: number): string {
	return `restore_drill_${String(at)}`;
}

/** Quotes an identifier for SQL (`"name"`, doubling quotes). */
function quoteIdentifier(name: string): string {
	return `"${name.replaceAll('"', '""')}"`;
}

/**
 * The restore drill over `pg_restore` (enhancement 2.6), with a login that may CREATE and DROP databases on the
 * live server (`RESTORE_DRILL_DATABASE_URL`): restore into `restore_drill_<time>`, check, drop.
 */
export class PgRestoreDrillAdapter implements RestoreDrillPort {
	public constructor(
		private readonly drillUrl: string | null,
		/** Where `pg_restore` is looked up (the API's own `PATH`). */
		private readonly searchPath: string,
		private readonly now: () => number = Date.now,
	) {}

	public availability(): { readonly ready: true } | { readonly ready: false; readonly reason: string } {
		return this.drillUrl === null ? { ready: false, reason: "RESTORE_DRILL_DATABASE_URL is not set" } : { ready: true };
	}

	public async restoreAndCheck(dump: Readable): Promise<RestoreDrillChecks> {
		const url = this.drillUrl;
		if (url === null) {
			return { tablesChecked: 0, rowsRestored: 0, migration: null, failures: ["RESTORE_DRILL_DATABASE_URL is not set"] };
		}
		const name = restoreDrillDatabaseName(this.now());
		const admin = new Client({ connectionString: url });
		await admin.connect();
		try {
			await admin.query(`CREATE DATABASE ${quoteIdentifier(name)}`);
			const restored = await this.pgRestore(url, name, dump);
			if (restored !== null) {
				return { tablesChecked: 0, rowsRestored: 0, migration: null, failures: [`pg_restore failed: ${restored}`] };
			}
			return await this.check(url, name);
		} finally {
			await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(name)} WITH (FORCE)`);
			await admin.end();
		}
	}

	/** Restores `dump` into `database`; resolves null on success, or the error output. */
	private pgRestore(url: string, database: string, dump: Readable): Promise<string | null> {
		return new Promise((resolve): void => {
			// `pg_restore` needs the target named explicitly (it ignores PGDATABASE); credentials stay in the environment.
			const child = spawn("pg_restore", [...RESTORE_ARGS, `--dbname=${database}`], {
				env: { PATH: this.searchPath, ...pgEnvironment(url), PGDATABASE: database },
				stdio: ["pipe", "ignore", "pipe"],
			});
			let stderr = "";
			child.stderr.on("data", (chunk: Buffer): void => {
				stderr += chunk.toString();
			});
			child.once("error", (error: Error): void => {
				resolve(error.message);
			});
			child.once("close", (code: number | null): void => {
				resolve(code === 0 ? null : stderr.trim().slice(0, STDERR_EXCERPT_LENGTH) || `exited with ${String(code)}`);
			});
			dump.on("error", (error: Error): void => {
				child.stdin.destroy(error);
			});
			dump.pipe(child.stdin);
		});
	}

	private async check(url: string, database: string): Promise<RestoreDrillChecks> {
		const restoredUrl = new URL(url);
		restoredUrl.pathname = `/${database}`;
		const db = new Client({ connectionString: restoredUrl.toString() });
		await db.connect();
		try {
			const failures: string[] = [];
			const present = new Set(
				z
					.array(z.object({ table_name: z.string() }))
					.parse((await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`)).rows)
					.map((row) => row.table_name),
			);
			const missing = EXPECTED_TABLES.filter((table) => !present.has(table));
			if (missing.length > 0) {
				failures.push(`Tables missing from the restored copy: ${missing.join(", ")}`);
			}
			let rows = 0;
			for (const table of EXPECTED_TABLES.filter((name) => present.has(name))) {
				rows += Number(CountSchema.parse((await db.query(`SELECT count(*)::text AS count FROM public.${quoteIdentifier(table)}`)).rows.at(0)).count);
			}
			if (rows === 0) {
				failures.push("The restored copy holds no rows.");
			}
			const rls = z
				.array(RlsRowSchema)
				.parse((await db.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`)).rows);
			const unprotected = EXPECTED_TABLES.filter((table) => {
				const row = rls.find((candidate) => candidate.relname === table);
				return row === undefined || !row.relrowsecurity || !row.relforcerowsecurity;
			});
			if (unprotected.length > 0) {
				failures.push(`Row-level security isn't enabled and forced on: ${unprotected.join(", ")}`);
			}
			const migration = MigrationSchema.safeParse(
				(await db.query(`SELECT migration_name FROM public._prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`)).rows.at(0),
			);
			if (!migration.success) {
				failures.push("The restored copy has no finished migration.");
			}
			return { tablesChecked: EXPECTED_TABLES.length - missing.length, rowsRestored: rows, migration: migration.success ? migration.data.migration_name : null, failures };
		} finally {
			await db.end();
		}
	}
}

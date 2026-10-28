// ============================================
// infrastructure/backup/pg-dump.adapter.ts — `pg_dump` as the backup's own login
// ============================================
// Design patterns:
//   - ADAPTER for `DatabaseDumpPort`. Chooses the binary: the installed `pg_dump` when it is at least
//     the server's major version (an older client refuses a newer server), otherwise the configured
//     PostgreSQL image through Docker — never "install it with brew".
//   - The password never appears in a process list: the connection is passed in `PG*` environment
//     variables, not as a URL argument.

import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";

import { Client } from "pg";

import type { DatabaseDumpPort, RunningDump } from "../../application/ports/backup.ports";

/** `pg_dump (PostgreSQL) 18.1` → 18. */
export function majorOfPgDumpVersion(output: string): number | null {
	const match = /\(PostgreSQL\)\s+(?<major>\d+)/.exec(output);
	return match?.groups?.major === undefined ? null : Number(match.groups.major);
}

/** `180001` → 18. */
export function majorOfServerVersionNum(versionNum: string): number | null {
	const parsed = Number(versionNum);
	const perMajor = 10_000;
	return Number.isInteger(parsed) && parsed > 0 ? Math.floor(parsed / perMajor) : null;
}

/** The `PG*` variables for a connection URL (libpq reads them; nothing leaks into `ps`). */
export function pgEnvironment(url: string, hostOverride: string | null = null): Readonly<Record<string, string>> {
	const parsed = new URL(url);
	const defaultPort = "5432";
	const sslMode: string | null = parsed.searchParams.get("sslmode");
	return {
		PGHOST: hostOverride ?? parsed.hostname,
		PGPORT: parsed.port === "" ? defaultPort : parsed.port,
		PGUSER: decodeURIComponent(parsed.username),
		PGPASSWORD: decodeURIComponent(parsed.password),
		PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
		...(sslMode === null ? {} : { PGSSLMODE: sslMode }),
	};
}

/** Hosts a container must reach on its host machine instead. */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "::1"]);
const DOCKER_HOST_ALIAS = "host.docker.internal";
const DUMP_ARGS: readonly string[] = ["--format=custom", "--no-owner", "--no-privileges"];

type DumpProcess = ChildProcessByStdio<Writable | null, Readable, Readable>;

/** Runs a command and resolves its stdout (rejects with its stderr). */
function capture(command: string, args: readonly string[], env: Readonly<Record<string, string>>, searchPath: string): Promise<string> {
	return new Promise((resolve, reject): void => {
		const child = spawn(command, [...args], { env: { PATH: searchPath, ...env }, stdio: ["ignore", "pipe", "pipe"] });
		let out = "";
		let err = "";
		child.stdout.on("data", (chunk: Buffer): void => {
			out += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer): void => {
			err += chunk.toString();
		});
		child.once("error", reject);
		child.once("close", (code: number | null): void => {
			if (code === 0) {
				resolve(out.trim());
			} else {
				reject(new Error(err.trim() || `${command} exited with ${String(code)}`));
			}
		});
	});
}

export class PgDumpAdapter implements DatabaseDumpPort {
	public constructor(
		private readonly backupUrl: string | null,
		private readonly dockerImage: string,
		/** Where `pg_dump` and `docker` are looked up (the API's own `PATH`, from the config). */
		private readonly searchPath: string,
	) {}

	public availability(): { readonly ready: true } | { readonly ready: false; readonly reason: string } {
		return this.backupUrl === null
			? { ready: false, reason: "BACKUP_DATABASE_URL is not set — create the backup login with `pnpm --filter @workspace/api db:provision-backup-login`" }
			: { ready: true };
	}

	public async versions(): Promise<{ readonly pgDumpVersion: string; readonly serverVersion: string }> {
		const url: string = this.requireUrl();
		const plan = await this.plan(url);
		return { pgDumpVersion: plan.pgDumpVersion, serverVersion: plan.serverVersion };
	}

	public async dump(): Promise<RunningDump> {
		const url: string = this.requireUrl();
		const plan = await this.plan(url);
		const child: DumpProcess =
			plan.kind === "local"
				? spawn("pg_dump", [...DUMP_ARGS], { env: { PATH: this.searchPath, ...pgEnvironment(url) }, stdio: ["ignore", "pipe", "pipe"] })
				: spawn("docker", [...this.dockerArgs(url), "pg_dump", ...DUMP_ARGS], {
						env: { PATH: this.searchPath, ...this.dockerEnv(url) },
						stdio: ["ignore", "pipe", "pipe"],
					});
		let stderr = "";
		child.stderr.on("data", (chunk: Buffer): void => {
			stderr += chunk.toString();
		});
		const finished = new Promise<void>((resolve, reject): void => {
			child.once("error", reject);
			child.once("close", (code: number | null): void => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(stderr.trim() || `pg_dump exited with ${String(code)}`));
				}
			});
		});
		return { stream: child.stdout, finished };
	}

	private requireUrl(): string {
		if (this.backupUrl === null) {
			throw new Error("BACKUP_DATABASE_URL is not set");
		}
		return this.backupUrl;
	}

	/** Which `pg_dump` to run: the installed one if it is new enough, else the image. */
	private async plan(url: string): Promise<{ readonly kind: "local" | "docker"; readonly pgDumpVersion: string; readonly serverVersion: string }> {
		const client = new Client({ connectionString: url });
		await client.connect();
		let serverVersion = "";
		let serverMajor: number | null = null;
		try {
			const result = await client.query<{ serverVersion: string; serverVersionNum: string }>(
				`SELECT current_setting('server_version') AS "serverVersion", current_setting('server_version_num') AS "serverVersionNum"`,
			);
			const [row] = result.rows;
			serverVersion = row?.serverVersion ?? "";
			serverMajor = majorOfServerVersionNum(row?.serverVersionNum ?? "");
		} finally {
			await client.end();
		}
		const local: string | null = await capture("pg_dump", ["--version"], {}, this.searchPath).catch(() => null);
		const localMajor: number | null = local === null ? null : majorOfPgDumpVersion(local);
		if (local !== null && localMajor !== null && serverMajor !== null && localMajor >= serverMajor) {
			return { kind: "local", pgDumpVersion: local, serverVersion };
		}
		const docker: string = await capture("docker", [...this.dockerArgs(url), "pg_dump", "--version"], this.dockerEnv(url), this.searchPath).catch((error: unknown) => {
			throw new Error(
				`The installed pg_dump (${local ?? "none"}) is older than the server (${serverVersion}), and Docker could not run ${this.dockerImage}: ${error instanceof Error ? error.message : String(error)}`,
			);
		});
		return { kind: "docker", pgDumpVersion: `${docker} (${this.dockerImage})`, serverVersion };
	}

	private dockerEnv(url: string): Readonly<Record<string, string>> {
		const host: string = new URL(url).hostname;
		return pgEnvironment(url, LOOPBACK_HOSTS.has(host) ? DOCKER_HOST_ALIAS : null);
	}

	/** `docker run` passing the `PG*` variables by name (their values come from this process's environment). */
	private dockerArgs(url: string): string[] {
		const names: string[] = Object.keys(this.dockerEnv(url));
		return ["run", "--rm", "-i", `--add-host=${DOCKER_HOST_ALIAS}:host-gateway`, ...names.flatMap((name) => ["-e", name]), this.dockerImage];
	}
}

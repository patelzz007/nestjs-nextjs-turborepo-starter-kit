import { randomBytes } from "node:crypto";

import { z } from "zod";

/**
 * A PostgreSQL server that exists only for one command: `docker run --rm` on a random loopback port,
 * removed again when the command ends. `pnpm db:security-snapshot` builds its database there, because
 * roles belong to the whole server — two databases on the developer's own server share them, so a
 * snapshot taken there could never show a role that was created, changed or dropped.
 *
 * Nothing is added to compose.yml and the developer's own PostgreSQL is never touched.
 */

/** The image: the same major version as the project's PostgreSQL (compose.yml's commented `postgres` service). */
export const THROWAWAY_POSTGRES_IMAGE = "postgres:18.7";
/** The port PostgreSQL listens on inside the container. */
const CONTAINER_PORT = 5432;
/** The superuser the image creates. */
export const THROWAWAY_POSTGRES_USER = "postgres";
/** The database the image creates on start. */
export const THROWAWAY_POSTGRES_DATABASE = "security_snapshot";
/** Random bytes in a generated password / container suffix. */
const RANDOM_BYTES = 12;
/** How long to wait for the server to accept TCP connections, and how often to ask. */
const READY_ATTEMPTS = 60;
const READY_INTERVAL_MS = 500;

/** The result of one external command. */
export interface CommandResult {
	readonly status: number | null;
	readonly stdout: string;
	readonly stderr: string;
}

/** Runs one external command to completion (the real one is `spawnSync`; tests pass a fake). */
export type CommandRunner = (command: string, args: readonly string[]) => CommandResult;

/** Waits a number of milliseconds (tests pass one that returns at once). */
export type Sleep = (milliseconds: number) => Promise<void>;

/** Thrown when Docker is missing or the container cannot start or become ready. */
export class ThrowawayPostgresError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "ThrowawayPostgresError";
	}
}

/** A random lowercase-hex token. */
export function randomToken(): string {
	return randomBytes(RANDOM_BYTES).toString("hex");
}

/** `docker run` arguments: detached, removed on stop, published on a random port of 127.0.0.1 only. */
export function dockerRunArgs(name: string, password: string, image: string = THROWAWAY_POSTGRES_IMAGE): string[] {
	return [
		"run",
		"--rm",
		"--detach",
		"--name",
		name,
		"--env",
		`POSTGRES_PASSWORD=${password}`,
		"--env",
		`POSTGRES_DB=${THROWAWAY_POSTGRES_DATABASE}`,
		"--publish",
		`127.0.0.1::${String(CONTAINER_PORT)}`,
		image,
	];
}

/** `docker exec` arguments that succeed once the server accepts TCP connections (not just the init-time socket). */
export function readinessArgs(name: string): string[] {
	return ["exec", name, "pg_isready", "--host", "127.0.0.1", "--username", THROWAWAY_POSTGRES_USER, "--dbname", THROWAWAY_POSTGRES_DATABASE];
}

const PublishedPortSchema = z.coerce.number().int().positive();

/** The host port in `docker port <name> 5432` output (`127.0.0.1:55012`). */
export function parsePublishedPort(output: string): number {
	const [firstLine = ""] = output.trim().split("\n");
	const port = firstLine.slice(firstLine.lastIndexOf(":") + 1);
	return PublishedPortSchema.parse(port);
}

/** The connection URL of the throwaway database. */
export function throwawayDatabaseUrl(port: number, password: string): string {
	return `postgresql://${THROWAWAY_POSTGRES_USER}:${password}@127.0.0.1:${String(port)}/${THROWAWAY_POSTGRES_DATABASE}`;
}

/** One running throwaway server: its URL, and `stop()` to remove it. */
export interface ThrowawayPostgres {
	readonly databaseUrl: string;
	readonly stop: () => void;
}

function runOrThrow(run: CommandRunner, args: readonly string[], what: string): string {
	const result = run("docker", args);
	if (result.status !== 0) {
		throw new ThrowawayPostgresError(`${what} failed (docker ${args.join(" ")}): ${result.stderr.trim() || result.stdout.trim()}`);
	}
	return result.stdout;
}

/**
 * Starts the container and waits until it accepts connections. On any failure the container is removed
 * before the error is thrown, so a failed start leaves nothing running.
 */
export async function startThrowawayPostgres(run: CommandRunner, sleep: Sleep, image: string = THROWAWAY_POSTGRES_IMAGE): Promise<ThrowawayPostgres> {
	const name = `starter-kit-security-snapshot-${randomToken()}`;
	const password = randomToken();
	const stop = (): void => {
		run("docker", ["rm", "--force", name]);
	};
	runOrThrow(run, dockerRunArgs(name, password, image), "Starting the throwaway PostgreSQL");
	try {
		for (let attempt = 1; ; attempt += 1) {
			if (run("docker", readinessArgs(name)).status === 0) {
				break;
			}
			if (attempt >= READY_ATTEMPTS) {
				throw new ThrowawayPostgresError(`The throwaway PostgreSQL (${name}) did not accept connections in time.`);
			}
			await sleep(READY_INTERVAL_MS);
		}
		const port = parsePublishedPort(runOrThrow(run, ["port", name, String(CONTAINER_PORT)], "Reading the published port"));
		return { databaseUrl: throwawayDatabaseUrl(port, password), stop };
	} catch (error: unknown) {
		stop();
		throw error;
	}
}

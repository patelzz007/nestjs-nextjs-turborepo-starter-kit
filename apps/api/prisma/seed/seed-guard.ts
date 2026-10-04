import { z } from "zod";

import { ALLOW_DESTRUCTIVE_FLAG } from "./seed-options";

// ---------------------------------------------------------------------------
// The seed replaces the demo tenants' rows. It must never run against a shared
// or production database by accident, so it refuses unless the target is a
// LOCAL database in a development/test environment — or the operator passes
// `--allow-destructive` explicitly.
// ---------------------------------------------------------------------------

/** Environments the seed may run in without the explicit opt-in. */
const SEEDABLE_NODE_ENVS: ReadonlySet<string> = new Set<string>(["development", "test"]);

/** Hosts that are this machine (or the local docker-compose Postgres service). */
const LOCAL_DATABASE_HOSTS: ReadonlySet<string> = new Set<string>(["localhost", "127.0.0.1", "[::1]", "::1", "postgres"]);

const SeedEnvironmentSchema = z.object({
	NODE_ENV: z.string().optional(),
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required to seed"),
});

export class SeedRefusedError extends Error {
	public constructor(reason: string) {
		super(`Refusing to seed: ${reason}. Re-run with ${ALLOW_DESTRUCTIVE_FLAG} if you really mean to seed this database.`);
		this.name = "SeedRefusedError";
	}
}

/** Why the target is not a local development/test database, or `null` when it is. */
export function seedRefusalReason(environment: Readonly<Record<string, string | undefined>>): string | null {
	const env = SeedEnvironmentSchema.parse(environment);
	const nodeEnv = env.NODE_ENV ?? "";
	if (!SEEDABLE_NODE_ENVS.has(nodeEnv)) {
		return `NODE_ENV is "${nodeEnv}" (only development or test may be seeded)`;
	}
	const host = new URL(env.DATABASE_URL).hostname.toLowerCase();
	if (!LOCAL_DATABASE_HOSTS.has(host)) {
		return `DATABASE_URL points at "${host}", not a local database`;
	}
	return null;
}

/** @throws SeedRefusedError unless the target is local dev/test or `allowDestructive` is set. */
export function assertSeedAllowed(environment: Readonly<Record<string, string | undefined>>, allowDestructive: boolean): void {
	if (allowDestructive) {
		return;
	}
	const reason = seedRefusalReason(environment);
	if (reason !== null) {
		throw new SeedRefusedError(reason);
	}
}

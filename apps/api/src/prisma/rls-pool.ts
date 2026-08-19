import { Pool, type PoolClient, type PoolConfig } from "pg";

import { ThrownErrorSchema } from "@workspace/shared";

import { currentRlsContext } from "./rls-context";

/** Fail checkout instead of hanging until Fastify's plugin timeout. */
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;

type ConnectCallback = (err: Error | undefined, client?: PoolClient, done?: (release?: boolean | Error) => void) => void;

/**
 * Pool that stamps every checkout with `SET ROLE app_runtime` plus the RLS
 * session vars. Superuser `DATABASE_URL` bypasses RLS unless the session role
 * is a non-superuser (see `docs/prisma.md`).
 *
 * `pg.Pool.query` checks out via `connect(callback)`. Overriding only the
 * Promise form drops that callback and hangs every query (API never listens,
 * Swagger/login look “dead”).
 */
export class RlsPool extends Pool {
	public constructor(config: PoolConfig) {
		super({
			...config,
			connectionTimeoutMillis: config.connectionTimeoutMillis ?? DEFAULT_CONNECT_TIMEOUT_MS,
		});
	}

	public override connect(): Promise<PoolClient>;
	public override connect(callback: ConnectCallback): void;
	public override connect(callback?: ConnectCallback): Promise<PoolClient> | void {
		const ready: Promise<PoolClient> = this.checkoutWithRls();
		if (callback === undefined) {
			return ready;
		}
		void ready.then(
			(client: PoolClient): void => {
				callback(undefined, client, (release?: boolean | Error): void => {
					client.release(release);
				});
			},
			(error: object): void => {
				const parsed = ThrownErrorSchema.safeParse(error);
				callback(parsed.success ? new Error(parsed.data.message) : new Error("Failed to check out a Postgres client."));
			},
		);
	}

	private async checkoutWithRls(): Promise<PoolClient> {
		const client: PoolClient = await super.connect();
		try {
			await applyRlsSession(client);
			return client;
		} catch (error) {
			client.release(true);
			const parsed = ThrownErrorSchema.safeParse(error);
			if (parsed.success) {
				throw new Error(parsed.data.message);
			}
			throw new Error("Failed to apply Postgres RLS session on pool checkout.");
		}
	}
}

async function applyRlsSession(client: PoolClient): Promise<void> {
	const ctx = currentRlsContext();
	await client.query("SET ROLE app_runtime");
	await client.query("SELECT set_config('app.current_user_id', $1, false)", [ctx.userId]);
	await client.query("SELECT set_config('app.rls_bypass', $1, false)", [ctx.bypass ? "true" : "false"]);
}

import { Pool, type PoolClient, type PoolConfig } from "pg";

import { ThrownErrorSchema } from "@workspace/shared";

import { DEFAULT_DATABASE_ROLE } from "./system-operation.registry";

/** Fail checkout instead of hanging until Fastify's plugin timeout. */
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;

/** Pool settings the caller must decide explicitly (from the validated config). */
export type RlsPoolConfig = PoolConfig & Required<Pick<PoolConfig, "connectionString" | "max" | "idleTimeoutMillis" | "allowExitOnIdle">>;

type ConnectCallback = (err: Error | undefined, client?: PoolClient, done?: (release?: boolean | Error) => void) => void;

/**
 * Pool that switches every checkout to `app_runtime` (`SET ROLE`). The
 * superuser `DATABASE_URL` would bypass row-level security otherwise.
 * Identity settings (`app.current_user_id`, tenant, bypass, system operation)
 * are not copied onto the connection: `TenantTransactionService` sets them
 * transaction-locally, and they end when the transaction ends.
 *
 * `pg.Pool.query` checks out via `connect(callback)`. Overriding only the
 * Promise form drops that callback and hangs every query (API never listens,
 * Swagger/login look “dead”).
 */
export class RlsPool extends Pool {
	/**
	 * Pool tuning for Fastify's concurrent request model comes from the
	 * validated config (DB_POOL_MAX, DB_IDLE_TIMEOUT_MS; exit-on-idle only
	 * outside production) — the pool itself never reads the environment.
	 */
	public constructor(config: RlsPoolConfig) {
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

/** The one thing the checkout needs from a connection: run a parameterized statement (a `pg` `PoolClient` is one). */
export interface RlsSessionConnection {
	query(sql: string, values: string[]): Promise<object>;
}

/**
 * Switch a checked-out connection to the restricted runtime role.
 * `set_config('role', …)` is `SET ROLE` with a bind parameter. Request identity
 * is not stamped here; a transaction sets it with `is_local = true`.
 */
export async function applyRlsSession(client: RlsSessionConnection): Promise<void> {
	await client.query("SELECT set_config('role', $1, false)", [DEFAULT_DATABASE_ROLE]);
}

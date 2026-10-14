import { Pool, type PoolClient, type PoolConfig } from "pg";

import { ThrownErrorSchema } from "@workspace/shared";

import { currentRequestCorrelationId } from "../common/context/request-context";
import { currentRlsContextOrUnscoped, rlsSessionVariables } from "./rls-context";

/** `app.correlation_id` outside a request: SQL has no "absent" for a setting, and the readers treat `''` as NULL. */
const UNSET_CORRELATION_ID = "";

/** Fail checkout instead of hanging until Fastify's plugin timeout. */
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;

/** Pool settings the caller must decide explicitly (from the validated config). */
export type RlsPoolConfig = PoolConfig & Required<Pick<PoolConfig, "connectionString" | "max" | "idleTimeoutMillis" | "allowExitOnIdle">>;

type ConnectCallback = (err: Error | undefined, client?: PoolClient, done?: (release?: boolean | Error) => void) => void;

/**
 * Pool that stamps every checkout with `SET ROLE app_runtime` plus the RLS
 * session vars. Superuser `DATABASE_URL` bypasses RLS unless the session role
 * is a non-superuser (see `docs/technical/security/database-security.md`).
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
 * Stamp a checked-out connection with the RLS scope: the role (`SET ROLE` to
 * the scope's role — `app_runtime`, or a system operation's narrower role),
 * then the session variables the policies read. `set_config('role', …)` is
 * `SET ROLE` with a bind parameter; the value is always a `DatabaseRole`.
 * The current request's correlation id is stamped too (`''` outside a
 * request), so the data-change trail (ADR 051) can join a row change made
 * outside a `TenantTransactionService` transaction to its HTTP request; a
 * transaction overrides it transaction-locally.
 */
export async function applyRlsSession(client: RlsSessionConnection): Promise<void> {
	const ctx = currentRlsContextOrUnscoped();
	if (ctx.kind === "user" && ctx.requireExplicitContext && ctx.organizationId === null) {
		throw new Error("Tenant database access requires organization context — use TenantTransactionService");
	}
	const session = rlsSessionVariables(ctx);
	await client.query("SELECT set_config('role', $1, false)", [session.role]);
	await client.query("SELECT set_config('app.current_user_id', $1, false)", [session.currentUserId]);
	await client.query("SELECT set_config('app.rls_bypass', $1, false)", [session.rlsBypass]);
	await client.query("SELECT set_config('app.current_organization_id', $1, false)", [session.currentOrganizationId]);
	await client.query("SELECT set_config('app.system_operation', $1, false)", [session.systemOperation]);
	await client.query("SELECT set_config('app.current_api_key_id', $1, false)", [session.currentApiKeyId]);
	await client.query("SELECT set_config('app.current_api_key_location_id', $1, false)", [session.currentApiKeyLocationId]);
	await client.query("SELECT set_config('app.correlation_id', $1, false)", [currentRequestCorrelationId() ?? UNSET_CORRELATION_ID]);
}

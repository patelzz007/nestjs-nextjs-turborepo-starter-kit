/**
 * How long a pool checkout may wait for a new Postgres connection before it
 * fails — a dead or unreachable database surfaces as an error within this
 * bound instead of hanging requests until Fastify's own timeouts.
 */
export const DATABASE_CONNECT_TIMEOUT_MS = 5_000;

/**
 * The `application_name` each API pool connects with. PostgreSQL reports it on
 * every connection, and the data-change trail (ADR 051) records it on every
 * row change — so a write made outside a request's context still says which
 * pool made it.
 */
export const DATABASE_APPLICATION_NAME = {
	/** The request pool (`PrismaService`, `RlsPool`: SET ROLE app_runtime + RLS context). */
	request: "api",
	/** The system pool (`SystemPrismaService`: the deployment login, no RLS context). */
	system: "api-system",
} satisfies Record<string, string>;

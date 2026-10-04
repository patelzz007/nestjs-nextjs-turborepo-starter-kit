/**
 * How long a pool checkout may wait for a new Postgres connection before it
 * fails — a dead or unreachable database surfaces as an error within this
 * bound instead of hanging requests until Fastify's own timeouts.
 */
export const DATABASE_CONNECT_TIMEOUT_MS = 5_000;

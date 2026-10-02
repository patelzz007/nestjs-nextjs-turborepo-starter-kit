/** Request header carrying the client-generated idempotency key (IETF draft-ietf-httpapi-idempotency-key-header). */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/** Response header set to `true` when the body is a stored replay rather than a fresh execution. */
export const IDEMPOTENT_REPLAYED_HEADER = "Idempotent-Replayed";

/** How long a COMPLETED response is replayed for the same key (24 hours). */
export const IDEMPOTENCY_RETENTION_MS: number = 24 * 60 * 60 * 1000;

/**
 * Lease held by an IN_PROGRESS request (60 seconds). If the process crashes
 * mid-request the key frees itself after the lease instead of being stuck
 * forever. Must comfortably exceed the slowest idempotent handler.
 */
export const IDEMPOTENCY_IN_PROGRESS_LEASE_MS: number = 60 * 1000;

/** `Retry-After` hint (seconds) sent with 409 IDEMPOTENCY_REQUEST_IN_PROGRESS. */
export const IDEMPOTENCY_IN_PROGRESS_RETRY_AFTER_SECONDS = 1;

/** Allowlisted system operation for the bypass-only idempotency table (src/prisma/system-operation.registry.ts). */
export const IDEMPOTENCY_SYSTEM_OPERATION = "http.idempotency";

/** Allowlisted system operation the retention job deletes expired records under (src/prisma/system-operation.registry.ts). */
export const IDEMPOTENCY_RETENTION_OPERATION = "idempotency.retention";

/**
 * How long past `expiresAt` a record is kept before the retention job deletes
 * it (1 hour). An expired record is already equivalent to a missing one (the
 * service takes it over in place), so the grace only keeps the purge well
 * clear of a request taking over a just-expired row and absorbs clock skew
 * between API instances, which stamp `expiresAt` from their own clocks.
 * Applies to both states: COMPLETED rows (replay window over) and abandoned
 * IN_PROGRESS rows (lease over — `expiresAt` IS the lease deadline).
 */
export const IDEMPOTENCY_PURGE_GRACE_MS: number = 60 * 60 * 1000;

/** Rows deleted per retention transaction — small enough to keep each DELETE short. */
export const IDEMPOTENCY_PURGE_BATCH_SIZE = 500;

/** Wall-clock budget of one retention run (1 minute) — far below the schedule interval, so runs never overlap. */
export const IDEMPOTENCY_PURGE_TIME_BUDGET_MS: number = 60 * 1000;

/** Retention schedule (hourly). A run that hits its time budget leaves the rest for the next run. */
export const IDEMPOTENCY_PURGE_INTERVAL_MS: number = 60 * 60 * 1000;

/** BullMQ job-scheduler id for the retention job (one scheduler cluster-wide, upserted idempotently at boot). */
export const IDEMPOTENCY_PURGE_SCHEDULER_ID = "idempotency-retention";

/** Max length of the `scope` column (`@db.VarChar(200)`). */
export const IDEMPOTENCY_SCOPE_MAX_LENGTH = 200;

/** Reflector metadata key written by `@Idempotent()` and read by `IdempotencyInterceptor`. */
export const IDEMPOTENT_OPTIONS_METADATA = "platform:idempotent-options";

/** Per-endpoint idempotency behaviour. */
export interface IdempotentOptions {
	/** When true, requests without an `Idempotency-Key` header are rejected with 400 IDEMPOTENCY_KEY_REQUIRED. */
	readonly required: boolean;
}

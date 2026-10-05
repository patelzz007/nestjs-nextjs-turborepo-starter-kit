/** Postgres pool bounds of an inbox consumer (the consumer's env parser produces them). */
export interface DbPoolSettings {
	readonly max: number;
	readonly connectionTimeoutMs: number;
	readonly idleTimeoutMs: number;
	readonly statementTimeoutMs: number;
}

/** Bounded retry for failures that are not a record's own fault. */
export interface ProcessingRetrySettings {
	readonly maxAttempts: number;
	readonly baseDelayMs: number;
	readonly maxDelayMs: number;
}

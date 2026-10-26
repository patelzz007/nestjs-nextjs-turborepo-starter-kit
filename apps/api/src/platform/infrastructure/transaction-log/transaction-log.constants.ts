/** Name of the one job the `transaction-log.write` queue carries: append one entry. */
export const TRANSACTION_LOG_APPEND_JOB_NAME = "append";

/**
 * Workers that may run `transaction-log.write` jobs at once, across every API
 * instance (BullMQ's queue-wide limit): one, so the entries reach the file in
 * the order they were queued, and two instances sharing a folder never append
 * to the same file at the same moment.
 */
export const TRANSACTION_LOG_GLOBAL_CONCURRENCY = 1;

/** How often each instance deletes day files past their retention (hourly; the first run is at boot). */
export const TRANSACTION_LOG_RETENTION_INTERVAL_MS: number = 60 * 60 * 1000;

/** `SchedulerRegistry` name of the retention interval. */
export const TRANSACTION_LOG_RETENTION_INTERVAL_ID = "transaction-log-retention";

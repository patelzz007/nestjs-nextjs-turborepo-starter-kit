import { QUEUE_NAMES } from "@workspace/shared";

const MS_PER_HOUR: number = 60 * 60 * 1000;
const MS_PER_DAY: number = 24 * MS_PER_HOUR;

/** Allowlisted system operation the retention job deletes outbox rows under (src/prisma/system-operation.registry.ts). */
export const OUTBOX_RETENTION_OPERATION = "outbox.retention";

/** The `outbox.retention` BullMQ queue. */
export const OUTBOX_RETENTION_QUEUE = QUEUE_NAMES.outboxRetention;

/** BullMQ job-scheduler id (one scheduler cluster-wide, upserted idempotently at boot). */
export const OUTBOX_RETENTION_SCHEDULER_ID = "outbox-retention";

/** Name of the repeatable job the scheduler emits. */
export const OUTBOX_RETENTION_JOB_NAME = "purge-settled";

/**
 * How long a PUBLISHED row is kept after it was published (7 days). Once
 * published, the event lives in Kafka and every consumer dedupes by event id
 * in its own inbox, so the row is only an audit/debug trail of what left the
 * API — a week covers incident investigation without unbounded growth.
 */
export const OUTBOX_PUBLISHED_RETENTION_MS: number = 7 * MS_PER_DAY;

/**
 * How long a dead-lettered (FAILED) row is kept after it was dead-lettered
 * (30 days). Dead letters are counted by the dispatcher's backlog metric and
 * need an operator decision (fix + reset to PENDING, or accept the loss), so
 * they are kept much longer than published rows — but not forever.
 */
export const OUTBOX_DEAD_LETTER_RETENTION_MS: number = 30 * MS_PER_DAY;

/** Rows deleted per retention transaction — small enough to keep each DELETE short. */
export const OUTBOX_PURGE_BATCH_SIZE = 500;

/** Wall-clock budget of one retention run (1 minute) — far below the schedule interval, so runs never overlap. */
export const OUTBOX_PURGE_TIME_BUDGET_MS: number = 60 * 1000;

/** Retention schedule (hourly). A run that hits its time budget leaves the rest for the next run. */
export const OUTBOX_PURGE_INTERVAL_MS: number = MS_PER_HOUR;

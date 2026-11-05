import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { QueueNameSchema } from "../../../schemas/infrastructure/queue";
import { OPS_PERCENT_MAX } from "./operations";

// ── Background job queues in the operations console (enhancement 4.4) ─────────────────────────
// Depth, the last hour's failure rate and the failed jobs of every BullMQ queue, with audited retry and
// discard. A job's `data` is never shown: it can carry personal data. Its name, why it failed, its
// attempts and its times are enough to act on.

/** The window the failure rate covers: BullMQ keeps one data point per minute. */
export const OPS_QUEUE_METRICS_MINUTES = 60;
/** How many failed jobs one read lists (newest first). */
export const OPS_QUEUE_FAILED_JOBS_SHOWN = 50;
/** The longest job id accepted (BullMQ ids are ours: a uuid, or `<purpose>-<key>`). */
const OPS_QUEUE_JOB_ID_MAX_LENGTH = 256;
/** A retry or discard says why, like every other operations change. */
const OPS_QUEUE_REASON_MIN_LENGTH = 10;
const OPS_QUEUE_REASON_MAX_LENGTH = 500;

const CountSchema = z.number().int().nonnegative();

/** One queue: how much is waiting, and how the last hour went. */
export const OpsQueueSchema = z.object({
	name: QueueNameSchema,
	waiting: CountSchema,
	active: CountSchema,
	delayed: CountSchema,
	failed: CountSchema,
	paused: z.boolean(),
	completedLastHour: CountSchema,
	failedLastHour: CountSchema,
	/** Failed ÷ finished in the last hour; null when nothing finished. */
	failureRatePercent: z.number().min(0).max(OPS_PERCENT_MAX).nullable(),
});
export type OpsQueue = z.output<typeof OpsQueueSchema>;

/** The Queues screen in one read. */
export const OpsQueueListSchema = z.object({
	/** False where the API runs without Redis (no queues). */
	available: z.boolean(),
	metricsWindowMinutes: z.number().int().positive(),
	queues: z.array(OpsQueueSchema),
});
export type OpsQueueList = z.output<typeof OpsQueueListSchema>;

export const OpsQueuePathSchema = z.object({ queueName: QueueNameSchema }).strict();
export type OpsQueuePath = z.output<typeof OpsQueuePathSchema>;

/** One failed job, without its data. */
export const OpsFailedJobSchema = z.object({
	id: z.string(),
	name: z.string(),
	failedReason: z.string().nullable(),
	attemptsMade: CountSchema,
	maxAttempts: z.number().int().positive(),
	createdAt: EpochMsSchema,
	failedAt: EpochMsSchema.nullable(),
});
export type OpsFailedJob = z.output<typeof OpsFailedJobSchema>;

export const OpsFailedJobListSchema = z.object({
	queue: QueueNameSchema,
	/** Every failed job the queue holds; `jobs` is the newest {@link OPS_QUEUE_FAILED_JOBS_SHOWN}. */
	total: CountSchema,
	jobs: z.array(OpsFailedJobSchema),
});
export type OpsFailedJobList = z.output<typeof OpsFailedJobListSchema>;

export const OpsQueueJobPathSchema = OpsQueuePathSchema.extend({ jobId: z.string().min(1).max(OPS_QUEUE_JOB_ID_MAX_LENGTH) }).strict();
export type OpsQueueJobPath = z.output<typeof OpsQueueJobPathSchema>;

/** Retrying or discarding a failed job (the request body): why. */
export const OpsQueueJobActionSchema = z.object({ reason: z.string().trim().min(OPS_QUEUE_REASON_MIN_LENGTH).max(OPS_QUEUE_REASON_MAX_LENGTH) }).strict();
export type OpsQueueJobAction = z.output<typeof OpsQueueJobActionSchema>;

/** A retry or discard as the contract takes it: the job and why. */
export const OpsQueueJobActionInputSchema = OpsQueueJobPathSchema.extend(OpsQueueJobActionSchema.shape);
export type OpsQueueJobActionInput = z.output<typeof OpsQueueJobActionInputSchema>;

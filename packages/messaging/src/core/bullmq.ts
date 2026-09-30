import { z } from "zod";

/** One BullMQ retry preset (attempts, exponential backoff, retention). */
export interface QueueJobRetryOptions {
	readonly attempts: number;
	readonly backoff: { readonly type: "exponential"; readonly delay: number };
	readonly removeOnComplete: number;
	readonly removeOnFail: number;
}

type DefaultQueueJobPreset = "highRetry" | "lowRetry" | "publish";

/** Default BullMQ retry presets — copy or extend per app queue. */
export const DEFAULT_QUEUE_JOB_OPTIONS: Readonly<Record<DefaultQueueJobPreset, QueueJobRetryOptions>> = {
	highRetry: {
		attempts: 5,
		backoff: { type: "exponential", delay: 1_000 },
		removeOnComplete: 100,
		removeOnFail: 500,
	},
	lowRetry: {
		attempts: 3,
		backoff: { type: "exponential", delay: 2_000 },
		removeOnComplete: 50,
		removeOnFail: 200,
	},
	publish: {
		attempts: 8,
		backoff: { type: "exponential", delay: 1_500 },
		removeOnComplete: 200,
		removeOnFail: 1_000,
	},
};

/** Empty BullMQ scheduler payload — use for tick/sweep jobs with no data. */
export const EmptyQueuePayloadSchema = z.object({}).strict();

export type EmptyQueuePayload = z.output<typeof EmptyQueuePayloadSchema>;

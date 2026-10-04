/** One BullMQ retry preset (attempts, exponential backoff, retention). */
export interface QueueJobRetryOptions {
	readonly attempts: number;
	readonly backoff: { readonly type: "exponential"; readonly delay: number };
	readonly removeOnComplete: number;
	readonly removeOnFail: number;
}

type QueueJobFamily = "emailSend" | "maintenance" | "outboxPublish" | "storageDelete" | "storageScan" | "storageCdnInvalidate";

/** Default BullMQ retry settings per queue family. */
export const QUEUE_JOB_OPTIONS: Readonly<Record<QueueJobFamily, QueueJobRetryOptions>> = {
	emailSend: {
		attempts: 5,
		backoff: { type: "exponential", delay: 1_000 },
		removeOnComplete: 100,
		removeOnFail: 500,
	},
	maintenance: {
		attempts: 3,
		backoff: { type: "exponential", delay: 2_000 },
		removeOnComplete: 50,
		removeOnFail: 200,
	},
	outboxPublish: {
		attempts: 8,
		backoff: { type: "exponential", delay: 1_500 },
		removeOnComplete: 200,
		removeOnFail: 1_000,
	},
	storageDelete: {
		attempts: 5,
		backoff: { type: "exponential", delay: 5_000 },
		removeOnComplete: 100,
		removeOnFail: 500,
	},
	/** Scanner outages retry with backoff; the file stays SCANNING (never downloadable) until a verdict lands. */
	storageScan: {
		attempts: 8,
		backoff: { type: "exponential", delay: 5_000 },
		removeOnComplete: 200,
		removeOnFail: 1_000,
	},
	/** CDN purge of a withdrawn public asset: retried with backoff until CloudFront accepts it. */
	storageCdnInvalidate: {
		attempts: 8,
		backoff: { type: "exponential", delay: 5_000 },
		removeOnComplete: 100,
		removeOnFail: 500,
	},
};

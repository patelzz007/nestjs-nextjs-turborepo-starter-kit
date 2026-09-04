/** Default BullMQ retry settings per queue family. */
export const QUEUE_JOB_OPTIONS = {
	emailSend: {
		attempts: 5,
		backoff: { type: "exponential" as const, delay: 1_000 },
		removeOnComplete: 100,
		removeOnFail: 500,
	},
	maintenance: {
		attempts: 3,
		backoff: { type: "exponential" as const, delay: 2_000 },
		removeOnComplete: 50,
		removeOnFail: 200,
	},
	outboxPublish: {
		attempts: 8,
		backoff: { type: "exponential" as const, delay: 1_500 },
		removeOnComplete: 200,
		removeOnFail: 1_000,
	},
} as const;

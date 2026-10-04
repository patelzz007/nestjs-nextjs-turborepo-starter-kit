import { z } from "zod";

import { EmailPreviewPropValueSchema, EmailTemplateKeySchema } from "../email/email";
import { StorageProviderSchema } from "../domain/platform/storage";

/** Every BullMQ queue the API uses (must match compose Bull Board's QUEUE_NAMES list). */
export const QueueNameSchema = z.enum([
	"email.send",
	"rewards.auto-publish",
	"claims.expire-pending",
	"claims.expire-referrer",
	"outbox.publish",
	"storage.cleanup",
	"storage.delete",
	"idempotency.retention",
	"storage.scan",
	"outbox.retention",
	"rewards.referral-credit-notify",
	"storage.cdn-invalidate",
]);

/**
 * Queue names by purpose. Reference a queue as `QUEUE_NAMES.emailSend`, never
 * by position — inserting a queue must not silently re-point existing code.
 */
export const QUEUE_NAMES = {
	emailSend: QueueNameSchema.enum["email.send"],
	rewardsAutoPublish: QueueNameSchema.enum["rewards.auto-publish"],
	claimsExpirePending: QueueNameSchema.enum["claims.expire-pending"],
	claimsExpireReferrer: QueueNameSchema.enum["claims.expire-referrer"],
	outboxPublish: QueueNameSchema.enum["outbox.publish"],
	storageCleanup: QueueNameSchema.enum["storage.cleanup"],
	storageDelete: QueueNameSchema.enum["storage.delete"],
	idempotencyRetention: QueueNameSchema.enum["idempotency.retention"],
	storageScan: QueueNameSchema.enum["storage.scan"],
	outboxRetention: QueueNameSchema.enum["outbox.retention"],
	rewardsReferralCreditNotify: QueueNameSchema.enum["rewards.referral-credit-notify"],
	storageCdnInvalidate: QueueNameSchema.enum["storage.cdn-invalidate"],
} satisfies Readonly<Record<string, z.output<typeof QueueNameSchema>>>;

/** All queue names, for infrastructure that registers or inspects every queue. */
export const ALL_QUEUE_NAMES: readonly z.output<typeof QueueNameSchema>[] = QueueNameSchema.options;

export type QueueName = z.output<typeof QueueNameSchema>;

/** One serializable template prop: a scalar, or a list of strings (`cc` / `bcc`). */
export const EmailJobPropValueSchema = z.union([EmailPreviewPropValueSchema, z.array(z.string())]);

export type EmailJobPropValue = z.output<typeof EmailJobPropValueSchema>;

/** Serializable email job payload — rebuilt into a template in the worker. */
export const EmailSendJobSchema = z
	.object({
		/** The `pending` email log row this job delivers — also the BullMQ job id and the provider idempotency key. */
		emailLogId: z.uuid(),
		templateKey: EmailTemplateKeySchema,
		props: z.record(z.string(), EmailJobPropValueSchema),
	})
	.strict();

export type EmailSendJob = z.output<typeof EmailSendJobSchema>;

/** Empty payload for repeatable rewards maintenance jobs. */
export const RewardsMaintenanceJobSchema = z.object({}).strict();

export type RewardsMaintenanceJob = z.output<typeof RewardsMaintenanceJobSchema>;

export const StorageDeleteJobSchema = z
	.object({
		fileId: z.uuid(),
		provider: StorageProviderSchema,
		container: z.string().min(1),
		path: z.string().min(1),
	})
	.strict();

export type StorageDeleteJob = z.output<typeof StorageDeleteJobSchema>;

/** Malware-scan job for one uploaded file (the file row is the source of truth for what to scan). */
export const StorageScanJobSchema = z
	.object({
		fileId: z.uuid(),
	})
	.strict();

export type StorageScanJob = z.output<typeof StorageScanJobSchema>;

/**
 * Purges a withdrawn public asset from the CDN cache (S3 + CloudFront). The
 * object keys are what the storage provider reported as possibly cached.
 */
export const StorageCdnInvalidationJobSchema = z
	.object({
		fileId: z.uuid(),
		objectKeys: z.array(z.string().min(1)).min(1),
	})
	.strict();

export type StorageCdnInvalidationJob = z.output<typeof StorageCdnInvalidationJobSchema>;

export const StorageCleanupJobSchema = z.object({}).strict();

export type StorageCleanupJob = z.output<typeof StorageCleanupJobSchema>;

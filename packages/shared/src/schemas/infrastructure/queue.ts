import { z } from "zod";

import { EmailPreviewPropValueSchema, EmailTemplateKeySchema } from "../email/email";

/** BullMQ queue names used by the API (must match compose Bull Board prefix). */
export const QUEUE_NAMES: ["email.send", "rewards.auto-publish", "claims.expire-pending", "claims.expire-referrer", "outbox.publish"] = [
	"email.send",
	"rewards.auto-publish",
	"claims.expire-pending",
	"claims.expire-referrer",
	"outbox.publish",
];

export const QueueNameSchema = z.enum(QUEUE_NAMES);

export type QueueName = z.output<typeof QueueNameSchema>;

/** Serializable email job payload — rebuilt into a template in the worker. */
export const EmailSendJobSchema = z
	.object({
		templateKey: EmailTemplateKeySchema,
		props: z.record(z.string(), EmailPreviewPropValueSchema),
	})
	.strict();

export type EmailSendJob = z.output<typeof EmailSendJobSchema>;

/** Empty payload for repeatable rewards maintenance jobs. */
export const RewardsMaintenanceJobSchema = z.object({}).strict();

export type RewardsMaintenanceJob = z.output<typeof RewardsMaintenanceJobSchema>;

import type { SystemOperationName } from "../../../../../platform/application/system-operation-names";

/** `UnitOfWork<WebhooksScope>`. */
export const WEBHOOKS_UNIT_OF_WORK = Symbol("WEBHOOKS_UNIT_OF_WORK");
/** `WebhookSecretsPort`. */
export const WEBHOOK_SECRETS = Symbol("WEBHOOK_SECRETS");
/** `WebhookSenderPort`. */
export const WEBHOOK_SENDER = Symbol("WEBHOOK_SENDER");
/** `WebhookUrlPolicyPort`. */
export const WEBHOOK_URL_POLICY = Symbol("WEBHOOK_URL_POLICY");
/** `WebhookIdGenerator`. */
export const WEBHOOK_IDS = Symbol("WEBHOOK_IDS");
/** `WebhooksReadPort`. */
export const WEBHOOK_READS = Symbol("WEBHOOK_READS");
/** `() => number` in [0, 1): the retry jitter's randomness (a fixed one in tests). */
export const WEBHOOK_RANDOM = Symbol("WEBHOOK_RANDOM");

/** Fanning events out and claiming due deliveries (a poller every few seconds: logged at debug). */
export const WEBHOOKS_SWEEP_OPERATION: SystemOperationName = "webhooks.outbound.sweep";
/** Sending one delivery and recording it. */
export const WEBHOOKS_DELIVER_OPERATION: SystemOperationName = "webhooks.outbound.deliver";
/** The daily purge of events past the retention window. */
export const WEBHOOKS_RETENTION_OPERATION: SystemOperationName = "webhooks.outbound.retention";

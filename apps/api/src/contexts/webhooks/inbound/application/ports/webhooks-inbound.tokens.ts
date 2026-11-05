import type { SystemOperationName } from "../../../../../platform/application/system-operation-names";

/** `InboundWebhookReceiverPort`: the one path every inbound webhook takes (other contexts inject it). */
export const INBOUND_WEBHOOK_RECEIVER = Symbol("INBOUND_WEBHOOK_RECEIVER");
/** `ReceivedWebhookStorePort`. */
export const RECEIVED_WEBHOOK_STORE = Symbol("RECEIVED_WEBHOOK_STORE");
/** `ReceivedWebhookReadPort`. */
export const RECEIVED_WEBHOOK_READ = Symbol("RECEIVED_WEBHOOK_READ");
/** `WebhookFailureReaderPort`. */
export const WEBHOOK_FAILURE_READER = Symbol("WEBHOOK_FAILURE_READER");
/** `number`: how many days a received webhook is kept (`INBOUND_WEBHOOK_RETENTION_DAYS`). */
export const RECEIVED_WEBHOOK_RETENTION_DAYS = Symbol("RECEIVED_WEBHOOK_RETENTION_DAYS");

/** Logging, claiming and answering a received webhook; pruning past the retention (system-operation.registry.ts). */
export const WEBHOOKS_INBOUND_RECORD_OPERATION: SystemOperationName = "webhooks.inbound.record";
/** The admin viewer's reads, after the AUDIT_LOG check. */
export const WEBHOOKS_INBOUND_READ_OPERATION: SystemOperationName = "webhooks.inbound.read";

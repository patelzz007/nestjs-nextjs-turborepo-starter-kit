import type { DeliveryEventOutcome, EmailLogCreate, EmailLogStatus } from "@workspace/shared";

import type { EmailLog } from "../aggregates/email-log.aggregate";

/** One verified delivery-webhook event, ready to record. */
export interface DeliveryEventRecord {
	/** The signed `webhook-id` header — unique per delivery, the dedupe key. */
	readonly webhookId: string;
	readonly eventType: string;
	readonly resendId: string;
	/** The `emailLogId` tag set at send time, when the event carries it. */
	readonly taggedEmailLogId: string | undefined;
	/** The status the event maps to; `undefined` for events the log ignores (tracking). */
	readonly status: EmailLogStatus | undefined;
	/** Statuses the row may be in for `status` to apply (forward transitions only). */
	readonly allowedFrom: readonly EmailLogStatus[];
	readonly detail: string | undefined;
	/** Epoch ms when the provider observed the event. */
	readonly occurredAt: number;
}

/** What recording a delivery event did, or `duplicate` when this webhook id was already recorded. */
export type DeliveryEventRecordResult =
	| { readonly kind: "recorded"; readonly outcome: DeliveryEventOutcome; readonly emailLogId: string | null }
	| { readonly kind: "duplicate" };

/**
 * Persistence of email log rows, bound to ONE open transaction (a scope).
 * Every status change is a compare-and-set, so a redelivered job or a webhook
 * racing the send outcome can never double-apply.
 */
export interface EmailLogRepository {
	/** Inserts an attempt row with a caller-assigned id (no read-back: `EmailLog` SELECT is bypass-only). */
	insert(id: string, input: EmailLogCreate): Promise<void>;
	findById(id: string): Promise<EmailLog | null>;
	/**
	 * `pending → sent` with the provider id; when a webhook already advanced the
	 * row, only the missing provider id is stored. `false` when another writer finalized it first.
	 */
	finalizeSent(log: EmailLog, resendId: string | null): Promise<boolean>;
	/** `pending → failed`. `false` when the row was no longer pending. */
	finalizeFailed(log: EmailLog, error: string): Promise<boolean>;
	/** Records one webhook event (once per webhook id) and applies it to its row when the transition is allowed. */
	recordDeliveryEvent(event: DeliveryEventRecord): Promise<DeliveryEventRecordResult>;
}

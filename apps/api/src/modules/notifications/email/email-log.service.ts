import { Injectable } from "@nestjs/common";
import type { EmailLog } from "@prisma/client";

import {
	EmailLogCreateSchema,
	EmailLogEntrySchema,
	EmailLogStatusSchema,
	epochMs,
	type EmailLogCreate,
	type EmailLogEntry,
	type EmailLogListQuery,
	type PaginatedServiceResult,
	type EmailLogStatus,
	type EmailLogUpdatedEvent,
} from "@workspace/shared";

import { mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";
import { EmailLogEventsService } from "./email-log-events.service";
import { EmailLogRepository, type DeliveryEventRecordResult } from "./email-log.repository";

/** What the outcome event of one attempt describes (the sender knows it; the row id alone does not). */
export interface EmailAttemptIdentity {
	readonly templateKey: string;
	readonly to: string;
}

/** A verified delivery-webhook event, as the controller hands it over. */
export interface DeliveryWebhookEvent {
	readonly webhookId: string;
	readonly eventType: string;
	readonly resendId: string;
	readonly taggedEmailLogId: string | undefined;
	/** The status the event maps to; `undefined` for events the log ignores (tracking). */
	readonly status: EmailLogStatus | undefined;
	readonly detail: string | undefined;
	readonly occurredAt: number;
}

/**
 * Allowed source statuses for each incoming status. A row only moves FORWARD
 * (or stays put idempotently); together with the event-time guard in the
 * repository this makes out-of-order webhooks harmless:
 *
 * - `pending` is the row's state while the provider call is in flight — a
 *   webhook can arrive before the call returns, so every outcome may follow it.
 * - `sent` is the first provider event — it can never regress a row that progressed.
 * - `delivered` may follow `bounced`: Resend retries SOFT bounces and emits
 *   `email.delivered` when a later attempt succeeds.
 * - `bounced` / `complained` / `failed` are (effectively) terminal.
 */
export const ALLOWED_FROM: Readonly<Record<EmailLogStatus, readonly EmailLogStatus[]>> = {
	pending: ["pending"],
	sent: ["pending", "sent"],
	delivered: ["pending", "sent", "delivered", "bounced"],
	bounced: ["pending", "sent", "delivered", "bounced"],
	complained: ["pending", "sent", "delivered", "bounced", "complained"],
	failed: ["pending", "sent", "delivered", "bounced", "complained", "failed"],
};

/**
 * Persistence for the outbound-email lifecycle.
 *
 * One row per send attempt, written BEFORE the provider is called (`pending`)
 * so no email ever leaves without a log row; the outcome finalizes it once
 * (`sent` / `failed`) and emits ONE `email.log.updated` platform event in the
 * same transaction (transactional outbox). Verified Resend webhooks are
 * recorded in `email_delivery_events` (history, deduped by webhook id) and
 * move the row forward. Open/click tracking was deliberately removed, so
 * tracking events are recorded as `ignored`.
 */
@Injectable()
export class EmailLogService {
	public constructor(
		private readonly repository: EmailLogRepository,
		private readonly events: EmailLogEventsService,
		private readonly outbox: PlatformOutboxService,
	) {}

	/**
	 * Insert an attempt row. A `pending` row emits nothing yet (its outcome
	 * will); a row created already final (simulated modes) emits its event in
	 * the same transaction. Throws when the row cannot be written — the caller
	 * must then NOT send.
	 */
	public async create(input: EmailLogCreate): Promise<{ readonly id: string }> {
		const parsed: EmailLogCreate = EmailLogCreateSchema.parse(input);
		const event: EmailLogUpdatedEvent | null =
			parsed.status === "pending" ? null : toUpdatedEvent(parsed, parsed.status, parsed.resendId ?? null, parsed.error ?? null, parsed.durationMs ?? null);
		const row = await this.repository.create(parsed, async (tx): Promise<void> => {
			if (event !== null) {
				await this.outbox.enqueueInTransaction(tx, { type: "email.log.updated", payload: event });
			}
		});
		this.events.emitUpdated(event ?? undefined);
		return row;
	}

	/** Current status of one attempt row (`null` when it does not exist). */
	public async findStatus(id: string): Promise<EmailLogStatus | null> {
		return this.repository.findStatus(id);
	}

	/** Finalize a successful send once. Returns false when another writer already finalized it. */
	public async finalizeSent(id: string, attempt: EmailAttemptIdentity, resendId: string, durationMs: number | null): Promise<boolean> {
		const event = toUpdatedEvent(attempt, "sent", resendId, null, durationMs);
		const finalized = await this.repository.finalizeSent(id, resendId, async (tx): Promise<void> => {
			await this.outbox.enqueueInTransaction(tx, { type: "email.log.updated", payload: event });
		});
		if (finalized) {
			this.events.emitUpdated(event);
		}
		return finalized;
	}

	/** Finalize a failed send once. Returns false when the row was no longer pending. */
	public async finalizeFailed(id: string, attempt: EmailAttemptIdentity, error: string, durationMs: number | null): Promise<boolean> {
		const event = toUpdatedEvent(attempt, "failed", null, error, durationMs);
		const finalized = await this.repository.finalizeFailed(id, error, async (tx): Promise<void> => {
			await this.outbox.enqueueInTransaction(tx, { type: "email.log.updated", payload: event });
		});
		if (finalized) {
			this.events.emitUpdated(event);
		}
		return finalized;
	}

	/** Record + apply one verified delivery webhook event (see `EmailLogRepository.recordDeliveryEvent`). */
	public async applyDeliveryEvent(event: DeliveryWebhookEvent): Promise<DeliveryEventRecordResult> {
		const allowedFrom: readonly EmailLogStatus[] = event.status === undefined ? [] : ALLOWED_FROM[EmailLogStatusSchema.parse(event.status)];
		const result = await this.repository.recordDeliveryEvent({ ...event, allowedFrom });
		if (result.kind === "recorded" && result.outcome === "applied") {
			this.events.emitUpdated();
		}
		return result;
	}

	/**
	 * One page of email-log rows for the admin log page (newest first by
	 * default). `bigint` epochs are mapped to numbers and every row is
	 * re-validated by the strict wire schema.
	 */
	public async list(query: EmailLogListQuery): Promise<PaginatedServiceResult<EmailLogEntry>> {
		const result = await this.repository.list(query);
		return toPaginatedServiceResult(mapListResult(result, toEmailLogEntry), query);
	}
}

function toUpdatedEvent(
	attempt: EmailAttemptIdentity,
	status: EmailLogStatus,
	resendId: string | null,
	error: string | null,
	durationMs: number | null,
): EmailLogUpdatedEvent {
	// The recipient address is deliberately NOT part of the platform event (PII on the Kafka wire).
	return { templateKey: attempt.templateKey, status, resendId, error, durationMs };
}

/** Persistence row → the public `EmailLogEntry` contract. */
export function toEmailLogEntry(row: EmailLog): EmailLogEntry {
	return EmailLogEntrySchema.parse({
		id: row.id,
		templateKey: row.templateKey,
		to: row.to,
		subject: row.subject,
		status: row.status,
		resendId: row.resendId ?? undefined,
		error: row.error ?? undefined,
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	});
}

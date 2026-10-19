import { EmailLogStatusSchema, type EmailLogStatus, type EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { CorruptEmailLogStateError } from "../errors/notifications.errors";
import { EmailAttemptFinalized } from "../events/email-log-updated.event";

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

/** An email log row as persistence stores it. `status` is a TEXT column, so it is untrusted until parsed. */
export interface EmailLogState {
	readonly id: string;
	readonly templateKey: string;
	readonly to: string;
	readonly status: string;
}

/**
 * One outbound email attempt: written `pending` before anything is sent, then
 * finalized exactly once (`sent` / `failed`), then moved forward by delivery
 * webhooks. Persistence applies every change as a compare-and-set on the
 * status this aggregate was loaded with, so concurrent writers never double-apply.
 */
export class EmailLog extends AggregateRoot<EmailAttemptFinalized> {
	private constructor(
		public readonly id: string,
		public readonly templateKey: string,
		public readonly to: string,
		private readonly loadedStatus: EmailLogStatus,
	) {
		super();
	}

	/** Mapper-only. An unknown stored status is corrupt state, never a guessed value (D32). */
	public static rehydrate(state: EmailLogState): EmailLog {
		const status = EmailLogStatusSchema.safeParse(state.status);
		if (!status.success) {
			throw new CorruptEmailLogStateError(state.id);
		}
		return new EmailLog(state.id, state.templateKey, state.to, status.data);
	}

	/** Parses a stored status for a read projection — same rule as {@link rehydrate}. */
	public static parseStoredStatus(emailLogId: string, status: string): EmailLogStatus {
		const parsed = EmailLogStatusSchema.safeParse(status);
		if (!parsed.success) {
			throw new CorruptEmailLogStateError(emailLogId);
		}
		return parsed.data;
	}

	/** The statuses a row may be in for `next` to apply (forward transitions only). */
	public static allowedFrom(next: EmailLogStatus): readonly EmailLogStatus[] {
		return ALLOWED_FROM[next];
	}

	public get status(): EmailLogStatus {
		return this.loadedStatus;
	}

	/** The status the compare-and-set expects. */
	public get concurrencyToken(): EmailLogStatus {
		return this.loadedStatus;
	}

	/** Only a `pending` row still waits for its provider call; anything else was already finalized (redelivered job). */
	public isAwaitingDelivery(): boolean {
		return this.loadedStatus === "pending";
	}

	/** The provider accepted the email. `resendId` is null for a provider without delivery webhooks (Mailpit). */
	public recordSent(resendId: string | null, durationMs: number | null, now: EpochMs): void {
		this.record(new EmailAttemptFinalized(now, this.id, { templateKey: this.templateKey, status: "sent", resendId, error: null, durationMs }));
	}

	/** The attempt failed for good (non-retryable, or out of attempts). */
	public recordFailed(error: string, durationMs: number | null, now: EpochMs): void {
		this.record(new EmailAttemptFinalized(now, this.id, { templateKey: this.templateKey, status: "failed", resendId: null, error, durationMs }));
	}
}

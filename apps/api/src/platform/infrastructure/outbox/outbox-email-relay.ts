import { NOTIFICATION_EMAIL_OUTBOX_TOPIC, NotificationEmailRequestedEnvelopeSchema, type NotificationEmailRequestedPayload } from "@workspace/shared";

import {
	OUTBOX_DISPATCH_LIMITS,
	OUTBOX_RETRY_POLICY,
	computeOutboxRetryDelayMs,
	type ClaimedOutboxRow,
	type OutboxClock,
	type OutboxDispatchLimits,
	type OutboxDispatchStore,
	type OutboxLogSink,
	type OutboxRetryPolicy,
} from "./outbox-dispatcher";

/**
 * Where an email request row is handed off (ADR 060). The notifications
 * context implements it: the BullMQ `emailSend` queue (jobId = email log id)
 * when Redis is configured, otherwise the inline delivery path. Platform only
 * knows this port, never the context.
 */
export interface OutboxEmailRequestTarget {
	handOff(request: NotificationEmailRequestedPayload): Promise<void>;
}

/** The one email-request target, registered by the notifications module at startup. */
export class OutboxEmailRouteRegistry {
	private target: OutboxEmailRequestTarget | null = null;

	public register(target: OutboxEmailRequestTarget): void {
		this.target = target;
	}

	public current(): OutboxEmailRequestTarget | null {
		return this.target;
	}
}

/** Row-state transitions of the email relay. Implemented by `OutboxDispatchRepository`. */
export interface OutboxEmailRelayStore extends Pick<OutboxDispatchStore, "claimDue" | "markPublished" | "scheduleRetry" | "release" | "markDeadLettered"> {
	claimById(id: string, nowMs: number, leaseMs: number): Promise<ClaimedOutboxRow | null>;
}

/** What happened to one email request row. */
export type OutboxEmailRelayOutcome = "handed_off" | "not_claimed" | "retry_scheduled" | "dead_lettered" | "no_target";

export interface OutboxEmailRelaySummary {
	readonly claimed: number;
	readonly handedOff: number;
	readonly retried: number;
	readonly deadLettered: number;
	readonly released: number;
}

type RowOutcome = { readonly kind: "handed_off" } | { readonly kind: "dead_lettered" } | { readonly kind: "retry_scheduled"; readonly availableAtMs: number };

/**
 * Relays `notification.email.requested` outbox rows to the email target —
 * never to Kafka. Same at-least-once contract as the Kafka dispatcher: claim
 * (lease), hand off, mark PUBLISHED. A crash between hand-off and mark hands
 * the same request off again; the target is idempotent by `emailLogId` (BullMQ
 * dedupes the job id, and delivery skips a row that is no longer `pending`).
 *
 * Failure handling matches the Kafka path: a malformed row is dead-lettered at
 * once; a hand-off failure spends an attempt with exponential backoff and
 * releases the rest of the batch (the queue is most likely down for all of
 * them); at `maxAttempts` the row is dead-lettered.
 */
export class OutboxEmailRelay {
	public constructor(
		private readonly store: OutboxEmailRelayStore,
		private readonly routes: OutboxEmailRouteRegistry,
		private readonly clock: OutboxClock,
		private readonly logger: OutboxLogSink,
		private readonly policy: OutboxRetryPolicy = OUTBOX_RETRY_POLICY,
		private readonly limits: OutboxDispatchLimits = OUTBOX_DISPATCH_LIMITS,
		private readonly random: () => number = Math.random,
	) {}

	/** One sweep over due email request rows. `null` when no target is registered (notifications not loaded). */
	public async relayDue(): Promise<OutboxEmailRelaySummary | null> {
		const target = this.routes.current();
		if (target === null) {
			return null;
		}
		const rows = await this.store.claimDue(this.limits.batchSize, this.clock.nowEpochMs(), this.limits.claimLeaseMs, "email");
		const summary = { claimed: rows.length, handedOff: 0, retried: 0, deadLettered: 0, released: 0 };
		for (const [index, row] of rows.entries()) {
			const outcome = await this.relayRow(target, row);
			if (outcome.kind === "handed_off") {
				summary.handedOff += 1;
				continue;
			}
			if (outcome.kind === "dead_lettered") {
				summary.deadLettered += 1;
				continue;
			}
			summary.retried += 1;
			const remaining = rows.slice(index + 1).map((pending) => pending.id);
			await this.store.release(remaining, outcome.availableAtMs, this.clock.nowEpochMs());
			summary.released = remaining.length;
			break;
		}
		if (summary.claimed > 0) {
			this.logger.log({ event: "outbox.email_relay_summary", ...summary });
		}
		return summary;
	}

	/** Hands off one row right after its transaction committed (the after-commit nudge). */
	public async relayOne(outboxEventId: string): Promise<OutboxEmailRelayOutcome> {
		const target = this.routes.current();
		if (target === null) {
			return "no_target";
		}
		const row = await this.store.claimById(outboxEventId, this.clock.nowEpochMs(), this.limits.claimLeaseMs);
		if (row === null) {
			// Already handed off (published), claimed by a concurrent sweep, or waiting out a backoff.
			return "not_claimed";
		}
		return (await this.relayRow(target, row)).kind;
	}

	private async relayRow(target: OutboxEmailRequestTarget, row: ClaimedOutboxRow): Promise<RowOutcome> {
		const envelope = NotificationEmailRequestedEnvelopeSchema.safeParse(row.payload);
		if (row.topic !== NOTIFICATION_EMAIL_OUTBOX_TOPIC || !envelope.success) {
			const error = envelope.success ? `unexpected topic "${row.topic}" for an email request` : `invalid email request envelope: ${envelope.error.message}`;
			await this.deadLetter(row, row.attempts, error, "malformed");
			return { kind: "dead_lettered" };
		}
		try {
			await target.handOff(envelope.data.payload);
		} catch (error) {
			return this.handleFailure(row, error instanceof Error ? error.message : String(error));
		}
		await this.store.markPublished([row.id], this.clock.nowEpochMs());
		this.logger.log({ event: "outbox.email_handed_off", eventId: row.id, emailLogId: envelope.data.payload.emailLogId, attempt: row.attempts + 1 });
		return { kind: "handed_off" };
	}

	private async handleFailure(row: ClaimedOutboxRow, error: string): Promise<RowOutcome> {
		const attempts = row.attempts + 1;
		if (attempts >= this.policy.maxAttempts) {
			await this.deadLetter(row, attempts, error, "max_attempts_exceeded");
			return { kind: "dead_lettered" };
		}
		const nowMs = this.clock.nowEpochMs();
		const delayMs = computeOutboxRetryDelayMs(this.policy, attempts, this.random);
		const availableAtMs = nowMs + delayMs;
		await this.store.scheduleRetry(row.id, attempts, error, availableAtMs, nowMs);
		this.logger.warn({ event: "outbox.email_hand_off_failed", eventId: row.id, attempt: attempts, maxAttempts: this.policy.maxAttempts, retryInMs: delayMs, error });
		return { kind: "retry_scheduled", availableAtMs };
	}

	private async deadLetter(row: ClaimedOutboxRow, attempts: number, error: string, reason: "malformed" | "max_attempts_exceeded"): Promise<void> {
		await this.store.markDeadLettered(row.id, attempts, error, this.clock.nowEpochMs());
		this.logger.error({ event: "outbox.dead_lettered", eventId: row.id, topic: row.topic, reason, attempts, error });
	}
}

import {
	KafkaTopicSchema,
	PLATFORM_EVENT_TOPICS,
	PlatformEventEnvelopeSchema,
	PlatformEventMessageSchema,
	QUEUE_JOB_OPTIONS,
	type JsonValue,
	type KafkaTopic,
	type PlatformEventMessage,
} from "@workspace/shared";

/** One claimed row, exactly as stored — validated by the dispatcher before publish. */
export interface ClaimedOutboxRow {
	readonly id: string;
	readonly topic: string;
	readonly partitionKey: string | null;
	readonly attempts: number;
	readonly payload: JsonValue;
}

export interface OutboxBacklog {
	readonly pendingCount: number;
	readonly oldestPendingCreatedAt: number | null;
	readonly deadLetteredCount: number;
}

/** Row-state transitions the dispatcher drives. Implemented by `OutboxDispatchRepository`. */
export interface OutboxDispatchStore {
	claimDue(limit: number, nowMs: number, leaseMs: number): Promise<readonly ClaimedOutboxRow[]>;
	markPublished(id: string, nowMs: number): Promise<void>;
	scheduleRetry(id: string, attempts: number, error: string, availableAtMs: number, nowMs: number): Promise<void>;
	release(ids: readonly string[], availableAtMs: number, nowMs: number): Promise<void>;
	markDeadLettered(id: string, attempts: number, error: string, nowMs: number): Promise<void>;
	readBacklog(): Promise<OutboxBacklog>;
}

/**
 * The publisher cannot reach its broker right now (e.g. Kafka not connected
 * yet) and did NOT attempt the send. Not a failure of the row: the dispatcher
 * releases the batch without spending an attempt, so an outage of any length
 * never dead-letters an event.
 */
export class OutboxPublisherUnavailableError extends Error {
	public constructor(message: string, options?: { readonly cause: Error }) {
		super(message, options);
		this.name = "OutboxPublisherUnavailableError";
	}
}

/**
 * Broker boundary. The message's `eventId` is the idempotency key for every consumer.
 * Throws {@link OutboxPublisherUnavailableError} when nothing was attempted (broker unreachable).
 */
export interface OutboxPublisher {
	publish(topic: KafkaTopic, message: PlatformEventMessage, partitionKey: string | null): Promise<void>;
}

export interface OutboxClock {
	nowEpochMs(): number;
}

/** Structured log sink (Nest `Logger` satisfies it). */
export interface OutboxLogSink {
	log(entry: OutboxLogEntry): void;
	warn(entry: OutboxLogEntry): void;
	error(entry: OutboxLogEntry): void;
}

export type OutboxLogEntry = Readonly<Record<string, string | number | null>>;

export interface OutboxRetryPolicy {
	/** Publish attempts before a row is dead-lettered (status FAILED). */
	readonly maxAttempts: number;
	readonly baseDelayMs: number;
	readonly maxDelayMs: number;
	/** ± fraction of the computed delay applied as random jitter. */
	readonly jitterRatio: number;
}

export interface OutboxDispatchLimits {
	readonly batchSize: number;
	/** How long a claimed row stays invisible to other sweepers — must exceed a batch's publish time. */
	readonly claimLeaseMs: number;
	/** Oldest-pending age past which every sweep warns (`outbox.backlog_stale`). */
	readonly staleBacklogAgeMs: number;
}

export interface OutboxDispatchSummary {
	readonly claimed: number;
	readonly published: number;
	readonly retried: number;
	readonly deadLettered: number;
	readonly released: number;
}

const BACKOFF_MULTIPLIER = 2;
const FIVE_MINUTES_MS = 5 * 60_000;
const TWO_MINUTES_MS = 2 * 60_000;
const OUTBOX_BATCH_SIZE = 50;
const OUTBOX_JITTER_RATIO = 0.2;

/**
 * Per-row retry policy — attempts and base delay reuse the `outboxPublish`
 * BullMQ preset so queue retries and row retries share one set of numbers.
 */
export const OUTBOX_RETRY_POLICY: OutboxRetryPolicy = {
	maxAttempts: QUEUE_JOB_OPTIONS.outboxPublish.attempts,
	baseDelayMs: QUEUE_JOB_OPTIONS.outboxPublish.backoff.delay,
	maxDelayMs: FIVE_MINUTES_MS,
	jitterRatio: OUTBOX_JITTER_RATIO,
};

export const OUTBOX_DISPATCH_LIMITS: OutboxDispatchLimits = {
	batchSize: OUTBOX_BATCH_SIZE,
	claimLeaseMs: TWO_MINUTES_MS,
	staleBacklogAgeMs: FIVE_MINUTES_MS,
};

/**
 * Exponential backoff with jitter, capped: `base × 2^(attempt-1)` clamped to
 * `maxDelayMs`, then ±`jitterRatio`. `random` returns a value in [0, 1).
 */
export function computeOutboxRetryDelayMs(policy: OutboxRetryPolicy, attempt: number, random: () => number): number {
	const exponential = policy.baseDelayMs * BACKOFF_MULTIPLIER ** Math.max(0, attempt - 1);
	const capped = Math.min(exponential, policy.maxDelayMs);
	const jitter = capped * policy.jitterRatio * (random() * BACKOFF_MULTIPLIER - 1);
	return Math.max(0, Math.round(capped + jitter));
}

type PreparedRow = { readonly kind: "ready"; readonly topic: KafkaTopic; readonly message: PlatformEventMessage } | { readonly kind: "malformed"; readonly error: string };

/**
 * Re-validates a stored row into the wire message. The stable `eventId` is
 * the row id, so a republish after a crash is recognisable downstream.
 */
export function prepareOutboxRow(row: ClaimedOutboxRow): PreparedRow {
	const topic = KafkaTopicSchema.safeParse(row.topic);
	if (!topic.success) {
		return { kind: "malformed", error: `unknown topic "${row.topic}"` };
	}
	const envelope = PlatformEventEnvelopeSchema.safeParse(row.payload);
	if (!envelope.success) {
		return { kind: "malformed", error: `invalid envelope: ${envelope.error.message}` };
	}
	if (PLATFORM_EVENT_TOPICS[envelope.data.type] !== topic.data) {
		return { kind: "malformed", error: `event type ${envelope.data.type} does not belong on topic ${topic.data}` };
	}
	const message = PlatformEventMessageSchema.safeParse({ ...envelope.data, eventId: row.id });
	if (!message.success) {
		return { kind: "malformed", error: `invalid wire message: ${message.error.message}` };
	}
	return { kind: "ready", topic: topic.data, message: message.data };
}

/**
 * At-least-once outbox → Kafka dispatcher.
 *
 * Per sweep: claim due rows (lease), publish each in `created_at` order, then
 * mark it PUBLISHED. A crash between publish and mark republishes the same
 * `eventId` later — consumers dedupe on it (inbox). Failure handling:
 * - malformed row → dead-letter now (FAILED; retrying cannot help);
 * - publish error → `attempts+1`, exponential backoff with jitter; at
 *   `maxAttempts` → dead-letter; the rest of the batch is released (not
 *   attempted) so a down broker is not hammered with one timeout per row;
 * - publisher unavailable (broker not connected, nothing sent) → the whole
 *   remaining batch is released for `baseDelayMs` WITHOUT spending an
 *   attempt — the rows stay PENDING for as long as the outage lasts.
 */
export class OutboxDispatcher {
	public constructor(
		private readonly store: OutboxDispatchStore,
		private readonly publisher: OutboxPublisher,
		private readonly clock: OutboxClock,
		private readonly logger: OutboxLogSink,
		private readonly policy: OutboxRetryPolicy = OUTBOX_RETRY_POLICY,
		private readonly limits: OutboxDispatchLimits = OUTBOX_DISPATCH_LIMITS,
		private readonly random: () => number = Math.random,
	) {}

	public async dispatchDue(): Promise<OutboxDispatchSummary> {
		const claimedAt = this.clock.nowEpochMs();
		const rows = await this.store.claimDue(this.limits.batchSize, claimedAt, this.limits.claimLeaseMs);
		const summary = { claimed: rows.length, published: 0, retried: 0, deadLettered: 0, released: 0 };

		for (const [index, row] of rows.entries()) {
			const outcome = await this.dispatchRow(row);
			if (outcome.kind === "published") {
				summary.published += 1;
				continue;
			}
			if (outcome.kind === "dead_lettered") {
				summary.deadLettered += 1;
				continue;
			}
			if (outcome.kind === "publisher_unavailable") {
				const unattempted = rows.slice(index).map((pending) => pending.id);
				const nowMs = this.clock.nowEpochMs();
				await this.store.release(unattempted, nowMs + this.policy.baseDelayMs, nowMs);
				summary.released = unattempted.length;
				this.logger.warn({ event: "outbox.publisher_unavailable", released: unattempted.length, retryInMs: this.policy.baseDelayMs, error: outcome.error });
				break;
			}
			summary.retried += 1;
			const remaining = rows.slice(index + 1).map((pending) => pending.id);
			await this.store.release(remaining, outcome.availableAtMs, this.clock.nowEpochMs());
			summary.released = remaining.length;
			break;
		}

		if (summary.claimed > 0) {
			this.logger.log({ event: "outbox.dispatch_summary", ...summary });
		}
		await this.reportBacklog();
		return summary;
	}

	private async dispatchRow(
		row: ClaimedOutboxRow,
	): Promise<
		| { readonly kind: "published" }
		| { readonly kind: "dead_lettered" }
		| { readonly kind: "retry_scheduled"; readonly availableAtMs: number }
		| { readonly kind: "publisher_unavailable"; readonly error: string }
	> {
		const prepared = prepareOutboxRow(row);
		if (prepared.kind === "malformed") {
			// The stored row can never be published — retrying cannot help.
			await this.deadLetter(row, row.attempts, prepared.error, "malformed");
			return { kind: "dead_lettered" };
		}

		const startedAt = this.clock.nowEpochMs();
		try {
			await this.publisher.publish(prepared.topic, prepared.message, row.partitionKey);
		} catch (error) {
			if (error instanceof OutboxPublisherUnavailableError) {
				return { kind: "publisher_unavailable", error: error.message };
			}
			return this.handlePublishFailure(row, error instanceof Error ? error.message : String(error));
		}

		const publishedAt = this.clock.nowEpochMs();
		await this.store.markPublished(row.id, publishedAt);
		this.logger.log({
			event: "outbox.published",
			eventId: row.id,
			eventType: prepared.message.type,
			topic: prepared.topic,
			correlationId: prepared.message.correlationId,
			attempt: row.attempts + 1,
			durationMs: publishedAt - startedAt,
		});
		return { kind: "published" };
	}

	private async handlePublishFailure(
		row: ClaimedOutboxRow,
		error: string,
	): Promise<{ readonly kind: "dead_lettered" } | { readonly kind: "retry_scheduled"; readonly availableAtMs: number }> {
		const attempts = row.attempts + 1;
		if (attempts >= this.policy.maxAttempts) {
			await this.deadLetter(row, attempts, error, "max_attempts_exceeded");
			return { kind: "dead_lettered" };
		}

		const nowMs = this.clock.nowEpochMs();
		const delayMs = computeOutboxRetryDelayMs(this.policy, attempts, this.random);
		const availableAtMs = nowMs + delayMs;
		await this.store.scheduleRetry(row.id, attempts, error, availableAtMs, nowMs);
		this.logger.warn({
			event: "outbox.publish_failed",
			eventId: row.id,
			topic: row.topic,
			attempt: attempts,
			maxAttempts: this.policy.maxAttempts,
			retryInMs: delayMs,
			error,
		});
		return { kind: "retry_scheduled", availableAtMs };
	}

	private async deadLetter(row: ClaimedOutboxRow, attempts: number, error: string, reason: "malformed" | "max_attempts_exceeded"): Promise<void> {
		await this.store.markDeadLettered(row.id, attempts, error, this.clock.nowEpochMs());
		this.logger.error({ event: "outbox.dead_lettered", eventId: row.id, topic: row.topic, reason, attempts, error });
	}

	private async reportBacklog(): Promise<void> {
		const backlog = await this.store.readBacklog();
		if (backlog.oldestPendingCreatedAt === null) {
			return;
		}
		const oldestPendingAgeMs = this.clock.nowEpochMs() - backlog.oldestPendingCreatedAt;
		if (oldestPendingAgeMs < this.limits.staleBacklogAgeMs) {
			return;
		}
		this.logger.warn({
			event: "outbox.backlog_stale",
			pendingCount: backlog.pendingCount,
			oldestPendingAgeMs,
			deadLetteredCount: backlog.deadLetteredCount,
		});
	}
}

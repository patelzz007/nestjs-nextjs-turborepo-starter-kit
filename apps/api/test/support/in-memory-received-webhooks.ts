import { epochMs, type ReceivedWebhookHeaders, type ReceivedWebhookOutcome, type ReceivedWebhookProvider, type ReceivedWebhookVerification } from "@workspace/shared";

import type { Clock } from "../../src/platform/application/clock.port";
import type {
	DeliveryClaim,
	DeliveryClaimRequest,
	DeliveryCompletion,
	ReceivedWebhookStorePort,
	RefusedWebhookRecord,
} from "../../src/contexts/webhooks/inbound/application/ports/received-webhook-store.port";
import { InboundWebhookReceiver } from "../../src/contexts/webhooks/inbound/application/services/inbound-webhook-receiver";
import { HttpWebhookFailureReader } from "../../src/contexts/webhooks/inbound/infrastructure/adapters/http-webhook-failure.reader";

/** One row of the in-memory received-webhook log, as the table would hold it. */
export interface StoredReceivedWebhook {
	readonly id: string;
	readonly provider: ReceivedWebhookProvider;
	readonly providerDeliveryId: string | null;
	eventType: string | null;
	readonly verification: ReceivedWebhookVerification;
	outcome: ReceivedWebhookOutcome;
	httpStatus: number | null;
	payloadSha256: string;
	payloadBytes: number;
	headers: ReceivedWebhookHeaders;
	correlationId: string | null;
	errorSummary: string | null;
	readonly receivedAt: number;
	lastReceivedAt: number;
	claimedAt: number | null;
	completedAt: number | null;
	attempts: number;
	duplicateCount: number;
}

const RETRYABLE_OUTCOMES: readonly ReceivedWebhookOutcome[] = ["FAILED", "REJECTED"];

/**
 * The received-webhook log in memory, with the Prisma store's claim semantics (one row per provider and
 * delivery id; FAILED / REJECTED / stale PROCESSING rows are claimed again; anything else is a redelivery).
 * The SQL itself is proved against PostgreSQL by test/inbound-webhooks.e2e-spec.ts.
 */
export class InMemoryReceivedWebhookStore implements ReceivedWebhookStorePort {
	public readonly rows: StoredReceivedWebhook[] = [];
	/** Set to make every write fail, as a lost database connection would. */
	public failWrites = false;
	private sequence = 0;

	public recordRefused(record: RefusedWebhookRecord): Promise<void> {
		if (this.failWrites) {
			return Promise.reject(new Error("database unavailable"));
		}
		this.rows.push({
			...record,
			id: this.nextId(),
			providerDeliveryId: null,
			eventType: null,
			outcome: "REJECTED",
			claimedAt: null,
			completedAt: record.receivedAt,
			lastReceivedAt: record.receivedAt,
			attempts: 1,
			duplicateCount: 0,
		});
		return Promise.resolve();
	}

	public claim(request: DeliveryClaimRequest): Promise<DeliveryClaim> {
		if (this.failWrites) {
			return Promise.reject(new Error("database unavailable"));
		}
		const existing =
			request.providerDeliveryId === null ? undefined : this.rows.find((row) => row.provider === request.provider && row.providerDeliveryId === request.providerDeliveryId);
		if (existing === undefined) {
			const id = this.nextId();
			this.rows.push({
				id,
				provider: request.provider,
				providerDeliveryId: request.providerDeliveryId,
				eventType: request.eventType,
				verification: "VALID",
				outcome: "PROCESSING",
				httpStatus: null,
				payloadSha256: request.payloadSha256,
				payloadBytes: request.payloadBytes,
				headers: request.headers,
				correlationId: request.correlationId,
				errorSummary: null,
				receivedAt: request.receivedAt,
				lastReceivedAt: request.receivedAt,
				claimedAt: request.receivedAt,
				completedAt: null,
				attempts: 1,
				duplicateCount: 0,
			});
			return Promise.resolve({ kind: "claimed", id });
		}
		const stale = existing.outcome === "PROCESSING" && existing.claimedAt !== null && existing.claimedAt < request.staleClaimBefore;
		if (RETRYABLE_OUTCOMES.includes(existing.outcome) || stale) {
			Object.assign(existing, {
				outcome: "PROCESSING",
				attempts: existing.attempts + 1,
				lastReceivedAt: request.receivedAt,
				claimedAt: request.receivedAt,
				correlationId: request.correlationId,
				payloadSha256: request.payloadSha256,
				payloadBytes: request.payloadBytes,
				headers: request.headers,
				httpStatus: null,
				errorSummary: null,
				completedAt: null,
			});
			return Promise.resolve({ kind: "claimed", id: existing.id });
		}
		existing.duplicateCount += 1;
		existing.lastReceivedAt = Math.max(existing.lastReceivedAt, request.receivedAt);
		return Promise.resolve({ kind: existing.outcome === "PROCESSING" ? "in_flight" : "duplicate", id: existing.id });
	}

	public complete(completion: DeliveryCompletion): Promise<void> {
		if (this.failWrites) {
			return Promise.reject(new Error("database unavailable"));
		}
		const row = this.rows.find((candidate) => candidate.id === completion.id);
		if (row !== undefined) {
			Object.assign(row, {
				outcome: completion.outcome,
				httpStatus: completion.httpStatus,
				errorSummary: completion.errorSummary,
				completedAt: completion.completedAt,
				...(completion.eventType === null ? {} : { eventType: completion.eventType }),
			});
		}
		return Promise.resolve();
	}

	public prune(beforeMs: number): Promise<number> {
		const kept = this.rows.filter((row) => row.lastReceivedAt >= beforeMs);
		const pruned = this.rows.length - kept.length;
		this.rows.splice(0, this.rows.length, ...kept);
		return Promise.resolve(pruned);
	}

	private nextId(): string {
		this.sequence += 1;
		return `received-webhook-${String(this.sequence)}`;
	}
}

/** A clock a test moves by hand. */
export class ManualClock implements Clock {
	public constructor(public nowMs: number) {}

	public now(): ReturnType<Clock["now"]> {
		return epochMs(this.nowMs);
	}
}

/** The real receiver over an in-memory log: what a receiving context's spec runs its route through. */
export function inMemoryWebhookReceiver(clock: Clock = new ManualClock(Date.now())): {
	readonly receiver: InboundWebhookReceiver;
	readonly store: InMemoryReceivedWebhookStore;
} {
	const store = new InMemoryReceivedWebhookStore();
	return { receiver: new InboundWebhookReceiver(store, new HttpWebhookFailureReader(), clock), store };
}

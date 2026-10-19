import {
	ANALYTICS_CONSUMER_ID,
	type AbortableSleep,
	type AnalyticsEventRow,
	type DeadLetterInput,
	type InboxClaim,
	type InboxStore,
	type InboxTransaction,
	type ConsumerLogger,
	type MessageHandlerDeps,
} from "@workspace/messaging/inbox";
import { RewardPlatformEventSchema } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { projectPlatformEvent, type PlatformEventDelivery } from "../platform-events.projection";

const ORGANIZATION_ID = "5c1f7a9e-2b4d-4e8f-a1b2-c3d4e5f60718";
const REVIEWER_ID = "8d0f3b0e-1f7a-4c55-9d1e-2f1a6b7c8d90";
const OCCURRED_AT_MS = 1_790_812_800_000;
const REWARD_TOPIC = "platform.rewards";
/** Bounded retry settings small enough for a unit test (no real waiting: the sleep resolves at once). */
const RETRY = { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 };
const MAX_DEAD_LETTER_PAYLOAD_BYTES = 1_024;

/** An inbox that commits a transaction's claim and analytics row together. */
class InMemoryInbox implements InboxStore {
	public readonly claims = new Set<string>();
	public readonly analytics: AnalyticsEventRow[] = [];
	public readonly deadLetters: DeadLetterInput[] = [];

	public async inTransaction<T>(work: (tx: InboxTransaction) => Promise<T>): Promise<T> {
		const staged: AnalyticsEventRow[] = [];
		const stagedClaims: string[] = [];
		const tx: InboxTransaction = {
			claim: (claim: InboxClaim): Promise<boolean> => {
				const key = `${claim.consumer}:${claim.eventId}`;
				if (this.claims.has(key) || stagedClaims.includes(key)) {
					return Promise.resolve(false);
				}
				stagedClaims.push(key);
				return Promise.resolve(true);
			},
			insertAnalyticsEvent: (row: AnalyticsEventRow): Promise<void> => {
				staged.push(row);
				return Promise.resolve();
			},
		};
		const result = await work(tx);
		for (const key of stagedClaims) {
			this.claims.add(key);
		}
		this.analytics.push(...staged);
		return result;
	}

	public park(deadLetter: DeadLetterInput): Promise<void> {
		this.deadLetters.push(deadLetter);
		return Promise.resolve();
	}
}

const SILENT: ConsumerLogger = { info: (): void => undefined, warn: (): void => undefined, error: (): void => undefined };
const immediate: AbortableSleep = (): Promise<void> => Promise.resolve();

/** A `reward.platform` wire message for `event`, as the API's outbox publishes it. */
function rewardDelivery(eventId: string, event: string, offset: string): PlatformEventDelivery {
	const value = JSON.stringify({
		eventId,
		type: "reward.platform",
		correlationId: "corr-review",
		occurredAt: OCCURRED_AT_MS,
		payload: { event, actorUserId: REVIEWER_ID, organizationId: ORGANIZATION_ID, metadata: { rewardId: "reward-1" } },
	});
	return { topic: REWARD_TOPIC, partition: 0, message: { offset, value: Buffer.from(value, "utf8") } };
}

describe("projectPlatformEvent", () => {
	let inbox: InMemoryInbox;
	let deps: MessageHandlerDeps;

	beforeEach(() => {
		inbox = new InMemoryInbox();
		deps = {
			store: inbox,
			logger: SILENT,
			consumerId: ANALYTICS_CONSUMER_ID,
			nowMs: (): number => OCCURRED_AT_MS,
			retry: RETRY,
			deadLetterMaxPayloadBytes: MAX_DEAD_LETTER_PAYLOAD_BYTES,
			sleep: immediate,
			random: (): number => 0,
			signal: new AbortController().signal,
		};
	});

	it.each([
		["reward.approved", "0b8f5a52-6a3c-4c3e-9d8e-5d8b5f0f4a11"],
		["reward.rejected", "1c9f6b63-7b4d-4d4f-8e9f-6e9c6f1f5b22"],
		["reward.auto_published", "2da07c74-8c5e-4e50-9fa0-7fad702f6c33"],
	])("ingests a %s review decision once into analytics_events", async (event: string, eventId: string) => {
		const outcome = await projectPlatformEvent(rewardDelivery(eventId, event, "7"), deps);

		expect(outcome).toEqual({ kind: "processed", eventId, attempts: 1 });
		expect(inbox.analytics.map((row) => [row.eventId, row.eventType, row.partitionKey])).toEqual([[eventId, "reward.platform", ORGANIZATION_ID]]);
		expect(inbox.deadLetters).toHaveLength(0);
	});

	it("accepts every reward platform action the shared schema defines", async () => {
		const actions = RewardPlatformEventSchema.shape.event.options;
		expect(actions).toEqual(expect.arrayContaining(["reward.approved", "reward.rejected"]));

		for (const [index, action] of actions.entries()) {
			const eventId = `3eb18d85-9d6f-4f61-8ab1-${String(index).padStart(12, "0")}`;
			const outcome = await projectPlatformEvent(rewardDelivery(eventId, action, String(index)), deps);
			expect(outcome.kind).toBe("processed");
		}
		expect(inbox.analytics).toHaveLength(actions.length);
	});

	it("parks an action the schema does not know instead of ingesting it", async () => {
		const outcome = await projectPlatformEvent(rewardDelivery("4fc29e96-ae70-4072-9bc2-90cf924f8e55", "reward.teleported", "9"), deps);

		expect(outcome.kind).toBe("parked");
		expect(inbox.analytics).toHaveLength(0);
		expect(inbox.deadLetters).toHaveLength(1);
	});

	it("ingests a redelivered decision exactly once", async () => {
		const delivery = rewardDelivery("5ad3af07-bf81-4183-8cd3-a1d0a3509f66", "reward.approved", "11");
		await projectPlatformEvent(delivery, deps);
		const redelivery = await projectPlatformEvent(delivery, deps);

		expect(redelivery.kind).toBe("duplicate");
		expect(inbox.analytics).toHaveLength(1);
	});
});
